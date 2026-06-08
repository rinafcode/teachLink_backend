import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  resolveIndexOptimizationConfig,
  IndexOptimizationConfig,
} from '../index-optimization.config';
import { IIndexUsageStat } from '../interfaces/index-optimization.interfaces';

/**
 * Reads index usage from pg_stat_user_indexes and the catalog.
 */
@Injectable()
export class IndexUsageMonitorService {
  private readonly logger = new Logger(IndexUsageMonitorService.name);
  private readonly config: IndexOptimizationConfig;

  private lastSnapshot: IIndexUsageStat[] = [];
  private lastSampledAt?: string;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional() config?: IndexOptimizationConfig,
  ) {
    this.config = config ?? resolveIndexOptimizationConfig();
  }

  async sample(): Promise<IIndexUsageStat[]> {
    const rows = await this.dataSource.query(
      `SELECT s.schemaname                          AS schema,
              s.relname                              AS table,
              s.indexrelname                         AS "indexName",
              COALESCE(s.idx_scan, 0)::bigint        AS scans,
              pg_relation_size(s.indexrelid)::bigint AS "sizeBytes",
              ix.indisunique                         AS "isUnique",
              ix.indisprimary                        AS "isPrimary",
              EXISTS (
                SELECT 1 FROM pg_constraint con
                 WHERE con.conindid = s.indexrelid
              )                                      AS "isConstraint"
         FROM pg_stat_user_indexes s
         JOIN pg_index ix ON ix.indexrelid = s.indexrelid
        WHERE s.schemaname = $1
        ORDER BY scans ASC`,
      [this.config.schema],
    );

    const stats: IIndexUsageStat[] = (rows as any[]).map((r) => ({
      schema: r.schema,
      table: r.table,
      indexName: r.indexName,
      scans: Number(r.scans),
      sizeBytes: Number(r.sizeBytes),
      isUnique: Boolean(r.isUnique),
      isPrimary: Boolean(r.isPrimary),
      isConstraint: Boolean(r.isConstraint),
    }));

    this.lastSnapshot = stats;
    this.lastSampledAt = new Date().toISOString();
    return stats;
  }

  async getSnapshot(): Promise<{
    sampledAt?: string;
    indexes: IIndexUsageStat[];
  }> {
    if (!this.lastSampledAt) await this.sample();
    return { sampledAt: this.lastSampledAt, indexes: this.lastSnapshot };
  }

  async findUnused(): Promise<IIndexUsageStat[]> {
    const stats = await this.sample();
    return stats.filter((s) => s.scans <= this.config.staleMinScans);
  }
}
