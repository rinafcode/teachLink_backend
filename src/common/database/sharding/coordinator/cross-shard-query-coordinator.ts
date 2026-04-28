import { ShardRouter } from '../router/shard.router';
import { ShardDataSourceManager } from '../datasource/shard-datasource.manager';
import { ShardAwareQueryRunner } from '../runner/shard-aware-query-runner';
import { Logger } from '@nestjs/common';

/**
 * Cross-Shard Query Coordinator
 * Manages and coordinates queries across multiple database shards
 */
export class CrossShardQueryCoordinator {
  private readonly logger = new Logger(CrossShardQueryCoordinator.name);
  private shardResultsCache: Map<string, any> = new Map();

  constructor(
    private shardRouter: ShardRouter,
    private dataSourceManager: ShardDataSourceManager,
  ) {}

  /**
   * Execute a query that spans multiple shards
   */
  async executeCrossShardQuery<T>(options: {
    query: string;
    shardKey?: string;
    shardGroup?: string;
    allShards?: boolean;
    aggregationStrategy?: 'merge' | 'union' | 'aggregate' | 'first';
    parameters?: any[];
    timeout?: number;
  }): Promise<T[]> {
    const {
      query,
      shardKey,
      shardGroup = 'primary',
      allShards = false,
      aggregationStrategy = 'merge',
      parameters = [],
      timeout = 30000,
    } = options;

    // Determine which shards to query
    let targetShards: string[];

    if (shardKey && !allShards) {
      // Route to specific shard(s)
      targetShards = this.shardRouter.routeReplicas(shardKey, shardGroup);
    } else {
      // Query all active shards
      targetShards = this.shardRouter.getActiveShards(shardGroup);
    }

    if (targetShards.length === 0) {
      throw new Error('No active shards available for query');
    }

    this.logger.debug(`Executing cross-shard query on ${targetShards.length} shards`);

    // Execute query on all target shards in parallel
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout exceeded')), timeout),
    );

    const queryPromises = targetShards.map((shardId) =>
      this.executeQueryOnShard(shardId, query, parameters),
    );

    let results: any[];

    try {
      const shardResults = await Promise.race([Promise.allSettled(queryPromises), timeoutPromise]);

      // Process results
      const successfulResults: any[][] = [];
      const errors: Error[] = [];

      for (let i = 0; i < shardResults.length; i++) {
        const result = shardResults[i];
        const shardId = targetShards[i];

        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
          this.logger.debug(`Query successful on shard ${shardId}: ${result.value.length} rows`);
        } else {
          errors.push(new Error(`Shard ${shardId}: ${result.reason.message}`));
          this.logger.warn(`Query failed on shard ${shardId}:`, result.reason);
        }
      }

      results = successfulResults.flat();

      // Handle partial failures
      if (errors.length > 0 && results.length === 0) {
        throw new Error(`All shard queries failed: ${errors.map((e) => e.message).join(', ')}`);
      }

      if (errors.length > 0) {
        this.logger.warn(
          `Partial failure: ${errors.length} shards failed, ${successfulResults.length} succeeded`,
        );
      }
    } catch (error) {
      this.logger.error('Cross-shard query failed:', error);
      throw error;
    }

    // Apply aggregation strategy
    return this.aggregateResults(results, aggregationStrategy);
  }

  /**
   * Execute a cross-shard aggregation query
   */
  async executeCrossShardAggregation<T>(
    aggregationQueries: {
      shardId?: string;
      query: string;
      parameters?: any[];
      mergeKey?: string;
    }[],
  ): Promise<T> {
    const results = new Map<string, any>();

    // Execute queries in parallel
    const queryPromises = aggregationQueries.map(async (queryConfig) => {
      const shardIds = queryConfig.shardId
        ? [queryConfig.shardId]
        : this.shardRouter.getActiveShards();

      const shardResults = await Promise.all(
        shardIds.map((shardId) =>
          this.executeQueryOnShard(shardId, queryConfig.query, queryConfig.parameters || []),
        ),
      );

      const mergedResults = shardResults.flat();

      if (queryConfig.mergeKey) {
        results.set(queryConfig.mergeKey, mergedResults);
      }

      return { key: queryConfig.mergeKey || 'result', data: mergedResults };
    });

    const queryResults = await Promise.all(queryPromises);

    // Merge results into aggregation object
    const aggregationResult: any = {};

    for (const result of queryResults) {
      aggregationResult[result.key] = result.data;
    }

    return aggregationResult as T;
  }

  /**
   * Execute distributed transaction across shards
   */
  async executeCrossShardTransaction<T>(
    operations: Array<{
      shardKey: string;
      query: string;
      parameters?: any[];
    }>,
  ): Promise<T> {
    const shardGroups = new Map<
      string,
      Array<{
        query: string;
        parameters?: any[];
      }>
    >();

    // Group operations by shard
    for (const operation of operations) {
      const shardId = this.shardRouter.route(operation.shardKey);
      const shardOps = shardGroups.get(shardId) || [];
      shardOps.push({ query: operation.query, parameters: operation.parameters });
      shardGroups.set(shardId, shardOps);
    }

    const coordinator = new ShardAwareQueryRunner(this.dataSourceManager);

    try {
      // Create query runners for all involved shards
      await coordinator.createQueryRunners(Array.from(shardGroups.keys()));

      // Start transactions on all shards
      await coordinator.startTransactions();

      // Execute operations on each shard
      for (const [shardId, ops] of shardGroups.entries()) {
        for (const op of ops) {
          await coordinator.query(shardId, op.query, op.parameters);
        }
      }

      // Commit all transactions
      await coordinator.commitTransactions();

      return { success: true } as T;
    } catch (error) {
      // Rollback on error
      await coordinator.rollbackTransactions();
      throw error;
    } finally {
      await coordinator.releaseAll();
    }
  }

  /**
   * Execute query on a specific shard
   */
  private async executeQueryOnShard(
    shardId: string,
    query: string,
    parameters: any[],
  ): Promise<any[]> {
    const dataSource = this.dataSourceManager.getDataSource(shardId);
    if (!dataSource) {
      throw new Error(`Shard ${shardId} not available`);
    }

    try {
      const result = await dataSource.query(query, parameters);
      return result || [];
    } catch (error) {
      this.logger.error(`Query execution failed on shard ${shardId}:`, error);
      throw new Error(`Shard ${shardId} query error: ${error.message}`);
    }
  }

  /**
   * Aggregate results from multiple shards
   */
  private aggregateResults<T>(results: any[], strategy: string): T[] {
    switch (strategy) {
      case 'union':
        return this.unionResults(results);
      case 'aggregate':
        return this.aggregateNumericResults(results);
      case 'first':
        return results.length > 0 ? results[0] : [];
      case 'merge':
      default:
        return this.mergeResults(results);
    }
  }

  /**
   * Merge results (remove duplicates based on id)
   */
  private mergeResults(results: any[]): any[] {
    const seen = new Set();
    return results.filter((item) => {
      const id = item.id || item._id;
      if (id && seen.has(id)) {
        return false;
      }
      if (id) {
        seen.add(id);
      }
      return true;
    });
  }

  /**
   * Union results (all records, including duplicates)
   */
  private unionResults(results: any[]): any[] {
    return results;
  }

  /**
   * Aggregate numeric results (sum, avg, count)
   */
  private aggregateNumericResults(results: any[]): any[] {
    if (results.length === 0) {
      return [];
    }

    const aggregated: any = {};

    for (const result of results) {
      for (const [key, value] of Object.entries(result)) {
        if (typeof value === 'number') {
          if (!aggregated[key]) {
            aggregated[key] = 0;
          }
          aggregated[key] += value;
        } else if (!aggregated[key]) {
          aggregated[key] = value;
        }
      }
    }

    return [aggregated];
  }

  /**
   * Get shard distribution statistics
   */
  getDistribution(): Map<string, number> {
    return this.shardRouter.getDistribution();
  }

  /**
   * Get health status of all shards
   */
  async getClusterHealth(): Promise<{
    totalShards: number;
    activeShards: number;
    inactiveShards: number;
    shardHealth: Array<{
      shardId: string;
      available: boolean;
      latency?: number;
    }>;
  }> {
    const shardIds = this.shardRouter.getAllShards();
    const shardHealth = await Promise.all(
      shardIds.map(async (shardId) => ({
        shardId,
        ...(await this.dataSourceManager.getShardHealth(shardId)),
      })),
    );

    const activeShards = shardHealth.filter((s) => s.available).length;
    const inactiveShards = shardHealth.filter((s) => !s.available).length;

    return {
      totalShards: shardIds.length,
      activeShards,
      inactiveShards,
      shardHealth,
    };
  }
}
