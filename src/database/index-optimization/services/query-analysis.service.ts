import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  resolveIndexOptimizationConfig,
  IndexOptimizationConfig,
} from '../index-optimization.config';
import {
  IIndexRecommendation,
  RecommendationReason,
} from '../interfaces/index-optimization.interfaces';

interface TableScanStat {
  table: string;
  seq_scan: number;
  idx_scan: number;
  n_live_tup: number;
}

interface ExistingIndex {
  table: string;
  index: string;
  columns: string[];
}

interface ForeignKeyColumns {
  table: string;
  columns: string[];
}

interface SlowStatement {
  query: string;
  calls: number;
  mean_exec_ms: number;
}

/**
 * Analyses PostgreSQL catalog and statistics to recommend indexes.
 */
@Injectable()
export class QueryAnalysisService {
  private readonly logger = new Logger(QueryAnalysisService.name);
  private readonly config: IndexOptimizationConfig;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional() config?: IndexOptimizationConfig,
  ) {
    this.config = config ?? resolveIndexOptimizationConfig();
  }

  /** Produce a prioritised list of index recommendations. */
  async analyze(): Promise<IIndexRecommendation[]> {
    const [scanStats, existingIndexes, fkColumns] = await Promise.all([
      this.getTableScanStats(),
      this.getExistingIndexes(),
      this.getForeignKeyColumns(),
    ]);

    const scanByTable = new Map(scanStats.map((s) => [s.table, s]));
    const recommendations: IIndexRecommendation[] = [];

    for (const fk of fkColumns) {
      if (this.hasCoveringIndex(existingIndexes, fk.table, fk.columns)) {
        continue;
      }

      const stat = scanByTable.get(fk.table);
      const isHotTable = this.isSeqScanHeavy(stat);
      const score = this.scoreRecommendation(stat);

      recommendations.push({
        table: fk.table,
        columns: fk.columns,
        reason: isHotTable ? RecommendationReason.HIGH_SEQ_SCAN : RecommendationReason.SLOW_QUERY,
        suggestedName: this.indexName(fk.table, fk.columns),
        ddl: this.createIndexDdl(fk.table, fk.columns),
        score,
        rationale: this.buildRationale(fk, stat),
      });
    }

    recommendations.sort((a, b) => b.score - a.score);
    return recommendations;
  }

  async getSlowStatements(limit = 20): Promise<SlowStatement[]> {
    if (!(await this.hasPgStatStatements())) {
      return [];
    }
    const rows = await this.query<SlowStatement>(
      `SELECT query, calls, mean_exec_time AS mean_exec_ms
         FROM pg_stat_statements
        WHERE mean_exec_time >= $1
        ORDER BY mean_exec_time DESC
        LIMIT $2`,
      [this.config.slowQueryMs, limit],
    );
    return rows;
  }

  private getTableScanStats(): Promise<TableScanStat[]> {
    return this.query<TableScanStat>(
      `SELECT relname AS table,
              COALESCE(seq_scan, 0)  AS seq_scan,
              COALESCE(idx_scan, 0)  AS idx_scan,
              COALESCE(n_live_tup, 0) AS n_live_tup
         FROM pg_stat_user_tables
        WHERE schemaname = $1`,
      [this.config.schema],
    );
  }

  private getExistingIndexes(): Promise<ExistingIndex[]> {
    return this.query<ExistingIndex>(
      `SELECT t.relname AS table,
              i.relname AS index,
              array_agg(a.attname ORDER BY k.ord) AS columns
         FROM pg_index ix
         JOIN pg_class i  ON i.oid = ix.indexrelid
         JOIN pg_class t  ON t.oid = ix.indrelid
         JOIN pg_namespace ns ON ns.oid = t.relnamespace
         JOIN unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
        WHERE ns.nspname = $1 AND k.attnum > 0
        GROUP BY t.relname, i.relname`,
      [this.config.schema],
    );
  }

  private getForeignKeyColumns(): Promise<ForeignKeyColumns[]> {
    return this.query<ForeignKeyColumns>(
      `SELECT cl.relname AS table,
              array_agg(att.attname ORDER BY u.ord) AS columns
         FROM pg_constraint con
         JOIN unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
         JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = u.attnum
         JOIN pg_class cl ON cl.oid = con.conrelid
         JOIN pg_namespace ns ON ns.oid = cl.relnamespace
        WHERE con.contype = 'f' AND ns.nspname = $1
        GROUP BY con.oid, cl.relname`,
      [this.config.schema],
    );
  }

  private async hasPgStatStatements(): Promise<boolean> {
    const rows = await this.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
       ) AS exists`,
    );
    return Boolean(rows[0]?.exists);
  }

  private hasCoveringIndex(indexes: ExistingIndex[], table: string, columns: string[]): boolean {
    return indexes
      .filter((ix) => ix.table === table)
      .some((ix) => this.startsWith(ix.columns, columns));
  }

  private startsWith(indexCols: string[], wanted: string[]): boolean {
    if (indexCols.length < wanted.length) return false;
    return wanted.every((c, i) => indexCols[i] === c);
  }

  private isSeqScanHeavy(stat?: TableScanStat): boolean {
    if (!stat) return false;
    const ratio = stat.idx_scan === 0 ? Infinity : stat.seq_scan / stat.idx_scan;
    return stat.seq_scan >= this.config.seqScanThreshold && ratio >= this.config.seqScanRatio;
  }

  private scoreRecommendation(stat?: TableScanStat): number {
    if (!stat) return 25;
    const scanComponent = Math.min(
      60,
      (stat.seq_scan / Math.max(this.config.seqScanThreshold, 1)) * 30,
    );
    const sizeComponent = Math.min(40, Math.log10(stat.n_live_tup + 1) * 10);
    return Math.round(Math.min(100, 20 + scanComponent + sizeComponent));
  }

  private buildRationale(fk: ForeignKeyColumns, stat?: TableScanStat): string {
    const cols = fk.columns.join(', ');
    const base = `Foreign-key column(s) (${cols}) on "${fk.table}" have no supporting index`;
    if (!stat) return `${base}.`;
    return (
      `${base}; table has ${stat.seq_scan} sequential scans vs ` +
      `${stat.idx_scan} index scans over ~${stat.n_live_tup} live rows.`
    );
  }

  indexName(table: string, columns: string[]): string {
    const raw = `idx_${table}_${columns.join('_')}`;
    return raw.length <= 63 ? raw : raw.slice(0, 63);
  }

  createIndexDdl(table: string, columns: string[]): string {
    const cols = columns.map((c) => `"${c}"`).join(', ');
    return `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${this.indexName(table, columns)}" ON "${this.config.schema}"."${table}" (${cols})`;
  }

  private async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.dataSource.query(sql, params) as Promise<T[]>;
  }
}
