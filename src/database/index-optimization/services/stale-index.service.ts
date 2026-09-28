import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  resolveIndexOptimizationConfig,
  IndexOptimizationConfig,
} from '../index-optimization.config';
import { IndexUsageMonitorService } from './index-usage-monitor.service';
import { IStaleIndex, IStaleIndexRemovalResult } from '../interfaces/index-optimization.interfaces';

/**
 * Detects and (optionally) removes stale indexes.
 */
@Injectable()
export class StaleIndexService {
  private readonly logger = new Logger(StaleIndexService.name);
  private readonly config: IndexOptimizationConfig;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly usageMonitor: IndexUsageMonitorService,
    @Optional() config?: IndexOptimizationConfig,
  ) {
    this.config = config ?? resolveIndexOptimizationConfig();
  }

  async findStaleIndexes(): Promise<IStaleIndex[]> {
    const unused = await this.usageMonitor.findUnused();

    return unused
      .filter(
        (idx) =>
          !idx.isPrimary &&
          !idx.isUnique &&
          !idx.isConstraint &&
          idx.sizeBytes >= this.config.staleMinSizeBytes,
      )
      .map((idx) => ({
        schema: idx.schema,
        table: idx.table,
        indexName: idx.indexName,
        scans: idx.scans,
        sizeBytes: idx.sizeBytes,
        ddl: `DROP INDEX CONCURRENTLY IF EXISTS "${idx.schema}"."${idx.indexName}"`,
        reason: 'Unused index.',
      }));
  }

  async removeStaleIndexes(dryRun = this.config.dryRun): Promise<IStaleIndexRemovalResult[]> {
    const stale = await this.findStaleIndexes();
    const results: IStaleIndexRemovalResult[] = [];

    for (const idx of stale) {
      if (dryRun) {
        results.push({
          indexName: idx.indexName,
          table: idx.table,
          dropped: false,
          skippedReason: 'dry-run',
        });
        continue;
      }
      results.push(await this.dropOne(idx));
    }

    return results;
  }

  private async dropOne(idx: IStaleIndex): Promise<IStaleIndexRemovalResult> {
    try {
      await this.dataSource.query(idx.ddl);
      return { indexName: idx.indexName, table: idx.table, dropped: true };
    } catch (err) {
      return {
        indexName: idx.indexName,
        table: idx.table,
        dropped: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
