import { Injectable, Logger } from '@nestjs/common';
import { ShardRouter } from './router/shard.router';
import { CrossShardQueryCoordinator } from './coordinator/cross-shard-query-coordinator';
import { ShardDataSourceManager } from './datasource/shard-datasource.manager';
import { ITransactionMetrics } from '../transaction.service';

/**
 * Shard-Aware Transaction Service
 * Extends transaction management with shard routing and cross-shard coordination
 */
@Injectable()
export class ShardTransactionService {
  private readonly logger = new Logger(ShardTransactionService.name);
  private readonly activeTransactions = new Map<string, ITransactionMetrics>();

  constructor(
    private shardRouter: ShardRouter,
    private queryCoordinator: CrossShardQueryCoordinator,
    private dataSourceManager: ShardDataSourceManager,
  ) {}

  /**
   * Execute transaction on a specific shard (determined by shard key)
   */
  async runOnShard<T>(
    shardKey: string,
    operation: (manager: any) => Promise<T>,
    shardGroup: string = 'primary',
  ): Promise<T> {
    const shardId = this.shardRouter.route(shardKey, shardGroup);
    const transactionId = this.generateTransactionId();
    const startTime = new Date();

    const metrics: ITransactionMetrics = {
      transactionId,
      startTime,
      status: 'STARTED',
      operations: [`shard:${shardId}`],
    };
    this.activeTransactions.set(transactionId, metrics);

    try {
      this.logger.debug(`Starting shard transaction ${transactionId} on ${shardId}`);

      const result = await this.dataSourceManager.runOnShard(shardId, operation);

      const endTime = new Date();
      metrics.endTime = endTime;
      metrics.duration = endTime.getTime() - startTime.getTime();
      metrics.status = 'COMMITTED';

      this.logger.log(
        `Shard transaction ${transactionId} committed on ${shardId} in ${metrics.duration}ms`,
      );

      return result;
    } catch (error) {
      const endTime = new Date();
      metrics.endTime = endTime;
      metrics.duration = endTime.getTime() - startTime.getTime();
      metrics.status = 'ROLLED_BACK';
      metrics.error = error instanceof Error ? error.message : String(error);

      this.logger.error(`Shard transaction ${transactionId} rolled back on ${shardId}:`, error);
      throw error;
    } finally {
      this.logger.debug(`Shard transaction ${transactionId} resources released`);
    }
  }

  /**
   * Execute cross-shard transaction
   */
  async runCrossShard<T>(
    operations: Array<{
      shardKey: string;
      query: string;
      parameters?: any[];
    }>,
  ): Promise<T> {
    const transactionId = this.generateTransactionId();
    const startTime = new Date();

    const metrics: ITransactionMetrics = {
      transactionId,
      startTime,
      status: 'STARTED',
      operations: ['cross-shard'],
    };
    this.activeTransactions.set(transactionId, metrics);

    try {
      this.logger.debug(
        `Starting cross-shard transaction ${transactionId} with ${operations.length} operations`,
      );

      const result = await this.queryCoordinator.executeCrossShardTransaction(operations);

      const endTime = new Date();
      metrics.endTime = endTime;
      metrics.duration = endTime.getTime() - startTime.getTime();
      metrics.status = 'COMMITTED';

      this.logger.log(
        `Cross-shard transaction ${transactionId} committed in ${metrics.duration}ms`,
      );

      return result as T;
    } catch (error) {
      const endTime = new Date();
      metrics.endTime = endTime;
      metrics.duration = endTime.getTime() - startTime.getTime();
      metrics.status = 'ROLLED_BACK';
      metrics.error = error instanceof Error ? error.message : String(error);

      this.logger.error(`Cross-shard transaction ${transactionId} rolled back:`, error);
      throw error;
    } finally {
      this.logger.debug(`Cross-shard transaction ${transactionId} resources released`);
    }
  }

  /**
   * Execute query across multiple shards
   */
  async crossShardQuery<T>(
    query: string,
    options?: {
      shardKey?: string;
      shardGroup?: string;
      allShards?: boolean;
      aggregationStrategy?: 'merge' | 'union' | 'aggregate' | 'first';
      parameters?: any[];
    },
  ): Promise<T[]> {
    return this.queryCoordinator.executeCrossShardQuery({
      query,
      ...options,
    });
  }

  /**
   * Execute cross-shard aggregation
   */
  async crossShardAggregate<T>(
    aggregationQueries: Array<{
      shardId?: string;
      query: string;
      parameters?: any[];
      mergeKey?: string;
    }>,
  ): Promise<T> {
    return this.queryCoordinator.executeCrossShardAggregation(aggregationQueries);
  }

  /**
   * Execute parallel operations on multiple shards
   */
  async parallelShardOperations<T>(
    operations: Array<{
      shardId: string;
      operation: (manager: any) => Promise<T>;
    }>,
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    const errors: Error[] = [];

    const executionPromises = operations.map(async ({ shardId, operation }) => {
      try {
        const result = await this.dataSourceManager.runOnShard(shardId, operation);
        results.set(shardId, result);
      } catch (error) {
        errors.push(new Error(`Shard ${shardId}: ${error.message}`));
      }
    });

    await Promise.all(executionPromises);

    if (errors.length > 0 && results.size === 0) {
      throw new Error(`All shard operations failed: ${errors.map((e) => e.message).join(', ')}`);
    }

    if (errors.length > 0) {
      this.logger.warn(
        `Partial failure: ${errors.length} shards failed, ${results.size} succeeded`,
      );
    }

    return results;
  }

  /**
   * Get active transactions
   */
  getActiveTransactions(): ITransactionMetrics[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Get transaction metrics
   */
  getTransactionMetrics(): ITransactionMetrics[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Clear completed transactions
   */
  clearCompletedTransactions(): void {
    const now = new Date();
    for (const [id, metrics] of this.activeTransactions.entries()) {
      if (metrics.endTime && now.getTime() - metrics.endTime.getTime() > 300000) {
        this.activeTransactions.delete(id);
      }
    }
  }

  /**
   * Generate transaction ID
   */
  private generateTransactionId(): string {
    return `stx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
