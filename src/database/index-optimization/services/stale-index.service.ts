import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  resolveIndexOptimizationConfig,
  IndexOptimizationConfig,
} from '../index-optimization.config';
import { IndexUsageMonitorService } from './index-usage-monitor.service';
import {
  IStaleIndex,
  IStaleIndexRemovalResult,
} from '../interfaces/index-optimization.interfaces';

/**
 * Detects and (optionally) removes stale indexes — those that have never been
 * scanned and are large enough to be worth reclaiming.
 *
 * Hard safety rules: primary keys, unique indexes and any constraint-backed
 * index are NEVER considered stale, because dropping them changes semantics or
 * is outright disallowed.
 */
@Injectable()
export class StaleIndexService {
  private readonly logger = new Logger(StaleIndexService.name);
  private readonly config: IndexOptimizationConfig;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly usageMonitor: IndexUsageMonitorService,
    config?: IndexOptimizationConfig,
  ) {
    this.config = config ?? resolveIndexOptimizationConfig();
  }

  /** Identify indexes eligible for removal. */
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
        reason:
          `Index has ${idx.scans} scans (≤ ${this.config.staleMinScans}) and ` +
          `occupies ${(idx.sizeBytes / 1024 / 1024).toFixed(1)} MB.`,
      }));
  }

  /**
   * Remove stale indexes.
   * @param dryRun overrides the configured dry-run flag for this call.
   */
  async removeStaleIndexes(
    dryRun = this.config.dryRun,
  ): Promise<IStaleIndexRemovalResult[]> {
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
      this.logger.log(`Dropping stale index ${idx.indexName} on ${idx.table}`);
      await this.dataSource.query(idx.ddl);
      return { indexName: idx.indexName, table: idx.table, dropped: true };
    } catch (err) {
      this.logger.error(
        `Failed to drop stale index ${idx.indexName}: ${String(err)}`,
      );
      return {
        indexName: idx.indexName,
        table: idx.table,
        dropped: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
