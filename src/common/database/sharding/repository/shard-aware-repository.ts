import { Injectable, Logger } from '@nestjs/common';
import { ShardRouter } from '../router/shard.router';
import { ShardDataSourceManager } from '../datasource/shard-datasource.manager';
import { CrossShardQueryCoordinator } from '../coordinator/cross-shard-query-coordinator';

/**
 * Shard-aware repository base class
 * Provides sharded data access operations
 */
@Injectable()
export abstract class ShardAwareRepository<T> {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected shardRouter: ShardRouter,
    protected dataSourceManager: ShardDataSourceManager,
    protected queryCoordinator: CrossShardQueryCoordinator,
    protected tableName: string,
  ) {}

  /**
   * Find by shard key (routes to specific shard)
   */
  async findOneByShardKey(shardKey: string, shardGroup: string = 'primary'): Promise<any | null> {
    const shardId = this.shardRouter.route(shardKey, shardGroup);
    const results = await this.dataSourceManager.query<any>(
      shardId,
      `SELECT * FROM ${this.tableName} WHERE shard_key = $1 LIMIT 1`,
      [shardKey],
    );
    return results[0] || null;
  }

  /**
   * Find by ID across all shards (expensive - use sparingly)
   */
  async findByIdCrossShard(id: string): Promise<any | null> {
    const results = await this.queryCoordinator.executeCrossShardQuery({
      query: `SELECT * FROM ${this.tableName} WHERE id = $1`,
      parameters: [id],
      allShards: true,
      aggregationStrategy: 'first',
    });
    return results[0] || null;
  }

  /**
   * Find all on specific shard
   */
  async findAllOnShard(shardId: string): Promise<any[]> {
    return this.dataSourceManager.query<any>(shardId, `SELECT * FROM ${this.tableName}`);
  }

  /**
   * Find all across all shards
   */
  async findAllCrossShard(): Promise<any[]> {
    return this.queryCoordinator.executeCrossShardQuery({
      query: `SELECT * FROM ${this.tableName}`,
      allShards: true,
      aggregationStrategy: 'merge',
    });
  }

  /**
   * Insert on specific shard
   */
  async insertOnShard(
    shardKey: string,
    data: Partial<T>,
    shardGroup: string = 'primary',
  ): Promise<any> {
    const shardId = this.shardRouter.route(shardKey, shardGroup);
    const columns = Object.keys(data).join(', ');
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const results = await this.dataSourceManager.query<any>(
      shardId,
      `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`,
      values,
    );
    return results[0];
  }

  /**
   * Update on specific shard
   */
  async updateOnShard(
    shardKey: string,
    data: Partial<T>,
    shardGroup: string = 'primary',
  ): Promise<any | null> {
    const shardId = this.shardRouter.route(shardKey, shardGroup);
    const setClause = Object.keys(data)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ');
    const values = Object.values(data);

    const results = await this.dataSourceManager.query<any>(
      shardId,
      `UPDATE ${this.tableName} SET ${setClause} WHERE shard_key = $${values.length + 1} RETURNING *`,
      [...values, shardKey],
    );
    return results[0] || null;
  }

  /**
   * Delete on specific shard
   */
  async deleteOnShard(shardKey: string, shardGroup: string = 'primary'): Promise<boolean> {
    const shardId = this.shardRouter.route(shardKey, shardGroup);
    const result = await this.dataSourceManager.query(
      shardId,
      `DELETE FROM ${this.tableName} WHERE shard_key = $1`,
      [shardKey],
    );
    return result.length > 0;
  }

  /**
   * Count on specific shard
   */
  async countOnShard(shardId: string): Promise<number> {
    const results = await this.dataSourceManager.query<{ count: string }>(
      shardId,
      `SELECT COUNT(*) as count FROM ${this.tableName}`,
    );
    return parseInt(results[0]?.count || '0', 10);
  }

  /**
   * Count across all shards
   */
  async countCrossShard(): Promise<number> {
    const results = await this.queryCoordinator.executeCrossShardQuery<{ count: string }>({
      query: `SELECT COUNT(*) as count FROM ${this.tableName}`,
      allShards: true,
      aggregationStrategy: 'aggregate',
    });
    return parseInt(results[0]?.count || '0', 10);
  }

  /**
   * Execute custom query on specific shard
   */
  async query(shardId: string, query: string, parameters?: any[]): Promise<any[]> {
    return this.dataSourceManager.query(shardId, query, parameters);
  }

  /**
   * Execute custom cross-shard query
   */
  async queryCrossShard(query: string, parameters?: any[]): Promise<any[]> {
    return this.queryCoordinator.executeCrossShardQuery({
      query,
      parameters,
      allShards: true,
      aggregationStrategy: 'merge',
    });
  }
}
