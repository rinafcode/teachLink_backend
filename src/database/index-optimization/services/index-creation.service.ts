import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  resolveIndexOptimizationConfig,
  IndexOptimizationConfig,
} from '../index-optimization.config';
import {
  IIndexCreationResult,
  IIndexRecommendation,
} from '../interfaces/index-optimization.interfaces';

/**
 * Applies index recommendations as real DDL.
 */
@Injectable()
export class IndexCreationService {
  private readonly logger = new Logger(IndexCreationService.name);
  private readonly config: IndexOptimizationConfig;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional() config?: IndexOptimizationConfig,
  ) {
    this.config = config ?? resolveIndexOptimizationConfig();
  }

  async createFromRecommendations(
    recommendations: IIndexRecommendation[],
    dryRun = this.config.dryRun,
  ): Promise<IIndexCreationResult[]> {
    const results: IIndexCreationResult[] = [];
    let createdCount = 0;

    for (const rec of recommendations) {
      if (createdCount >= this.config.maxCreatePerRun) {
        results.push(this.skip(rec, `per-run create limit (${this.config.maxCreatePerRun}) reached`));
        continue;
      }

      if (dryRun) {
        results.push(this.skip(rec, 'dry-run'));
        continue;
      }

      const result = await this.createOne(rec);
      results.push(result);
      if (result.created) createdCount++;
    }

    return results;
  }

  async createOne(rec: IIndexRecommendation): Promise<IIndexCreationResult> {
    try {
      await this.dataSource.query(rec.ddl);

      const valid = await this.isIndexValid(rec.suggestedName);
      if (!valid) {
        await this.dropInvalid(rec.suggestedName);
        return {
          suggestedName: rec.suggestedName,
          table: rec.table,
          ddl: rec.ddl,
          created: false,
          error: 'index build was invalid and has been dropped',
        };
      }

      return {
        suggestedName: rec.suggestedName,
        table: rec.table,
        ddl: rec.ddl,
        created: true,
      };
    } catch (err) {
      return {
        suggestedName: rec.suggestedName,
        table: rec.table,
        ddl: rec.ddl,
        created: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async isIndexValid(indexName: string): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `SELECT i.indisvalid AS valid
         FROM pg_class c
         JOIN pg_index i ON i.indexrelid = c.oid
        WHERE c.relname = $1`,
      [indexName],
    )) as Array<{ valid: boolean }>;
    return Boolean(rows[0]?.valid);
  }

  private async dropInvalid(indexName: string): Promise<void> {
    await this.dataSource.query(
      `DROP INDEX CONCURRENTLY IF EXISTS "${this.config.schema}"."${indexName}"`,
    );
  }

  private skip(rec: IIndexRecommendation, reason: string): IIndexCreationResult {
    return {
      suggestedName: rec.suggestedName,
      table: rec.table,
      ddl: rec.ddl,
      created: false,
      skippedReason: reason,
    };
  }
}
