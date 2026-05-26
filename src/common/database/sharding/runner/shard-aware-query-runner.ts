import { QueryRunner } from 'typeorm';
import { ShardDataSourceManager } from '../datasource/shard-datasource.manager';
import { Logger } from '@nestjs/common';

/**
 * Shard-Aware Query Runner
 * Wraps query runners to handle shard-specific operations
 */
export class ShardAwareQueryRunner {
  private readonly logger = new Logger(ShardAwareQueryRunner.name);
  private queryRunners: Map<string, QueryRunner> = new Map();

  constructor(private dataSourceManager: ShardDataSourceManager) {}

  /**
   * Create query runners for multiple shards
   */
  async createQueryRunners(shardIds: string[]): Promise<void> {
    for (const shardId of shardIds) {
      const queryRunner = await this.dataSourceManager.createQueryRunner(shardId);
      this.queryRunners.set(shardId, queryRunner);
    }
  }

  /**
   * Start transactions on multiple shards
   */
  async startTransactions(): Promise<void> {
    const promises = Array.from(this.queryRunners.entries()).map(async ([shardId, queryRunner]) => {
      await queryRunner.startTransaction();
      this.logger.debug(`Started transaction on shard ${shardId}`);
    });

    await Promise.all(promises);
  }

  /**
   * Commit transactions on multiple shards
   */
  async commitTransactions(): Promise<void> {
    const promises = Array.from(this.queryRunners.entries()).map(async ([shardId, queryRunner]) => {
      await queryRunner.commitTransaction();
      this.logger.debug(`Committed transaction on shard ${shardId}`);
    });

    await Promise.all(promises);
  }

  /**
   * Rollback transactions on multiple shards
   */
  async rollbackTransactions(): Promise<void> {
    const promises = Array.from(this.queryRunners.entries()).map(async ([shardId, queryRunner]) => {
      await queryRunner.rollbackTransaction();
      this.logger.debug(`Rolled back transaction on shard ${shardId}`);
    });

    await Promise.all(promises);
  }

  /**
   * Release all query runners
   */
  async releaseAll(): Promise<void> {
    const promises = Array.from(this.queryRunners.entries()).map(async ([shardId, queryRunner]) => {
      await queryRunner.release();
      this.logger.debug(`Released query runner for shard ${shardId}`);
    });

    await Promise.all(promises);
    this.queryRunners.clear();
  }

  /**
   * Execute operation across multiple shards with two-phase commit pattern
   */
  async executeCrossShardOperation<T>(
    operation: (manager: any, shardId: string) => Promise<T>,
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    const shardIds = Array.from(this.queryRunners.keys());

    try {
      // Phase 1: Prepare - execute operation on all shards
      for (const shardId of shardIds) {
        const queryRunner = this.queryRunners.get(shardId)!;
        const result = await operation(queryRunner.manager, shardId);
        results.set(shardId, result);
      }

      // Phase 2: Commit - if all operations succeeded
      await this.commitTransactions();
      this.logger.log('Cross-shard transaction committed successfully');

      return results;
    } catch (error) {
      // Phase 2 (rollback): Rollback all shards on any failure
      this.logger.error('Cross-shard transaction failed, rolling back', error);
      await this.rollbackTransactions();
      throw error;
    } finally {
      await this.releaseAll();
    }
  }

  /**
   * Execute query on a specific shard
   */
  async query(shardId: string, query: string, parameters?: any[]): Promise<any> {
    const queryRunner = this.queryRunners.get(shardId);
    if (!queryRunner) {
      throw new Error(`No query runner for shard ${shardId}`);
    }

    return queryRunner.query(query, parameters);
  }

  /**
   * Get query runner for a specific shard
   */
  getQueryRunner(shardId: string): QueryRunner | undefined {
    return this.queryRunners.get(shardId);
  }

  /**
   * Get all shard IDs with active query runners
   */
  getShardIds(): string[] {
    return Array.from(this.queryRunners.keys());
  }
}
