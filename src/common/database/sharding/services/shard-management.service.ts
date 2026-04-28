import { Injectable, Logger } from '@nestjs/common';
import { ShardRouter } from '../router/shard.router';
import { ShardDataSourceManager } from '../datasource/shard-datasource.manager';
import { CrossShardQueryCoordinator } from '../coordinator/cross-shard-query-coordinator';

/**
 * Shard Management Service
 * Provides utilities for shard management, rebalancing, and monitoring
 */
@Injectable()
export class ShardManagementService {
  private readonly logger = new Logger(ShardManagementService.name);

  constructor(
    private shardRouter: ShardRouter,
    private dataSourceManager: ShardDataSourceManager,
    private queryCoordinator: CrossShardQueryCoordinator,
  ) {}

  /**
   * Add a new shard to the cluster
   */
  async addShard(
    _shardId: string,
    _config: {
      name: string;
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
      weight?: number;
    },
  ): Promise<void> {
    // Note: In production, this would require dynamic configuration updates
    // and potentially rebalancing existing data
    throw new Error(
      'Shard addition requires configuration restart. Use migration utilities instead.',
    );
  }

  /**
   * Rebalance data across shards
   */
  async rebalanceShards(
    sourceShard: string,
    targetShard: string,
    table: string,
    keyField: string,
    filter?: string,
  ): Promise<{ rowsMoved: number; duration: number }> {
    const startTime = Date.now();

    this.logger.log(`Starting rebalance from ${sourceShard} to ${targetShard} for table ${table}`);

    // Get data to move
    const data = await this.dataSourceManager.query(
      sourceShard,
      `SELECT * FROM ${table} ${filter ? `WHERE ${filter}` : ''}`,
    );

    if (data.length === 0) {
      this.logger.log('No data to rebalance');
      return { rowsMoved: 0, duration: 0 };
    }

    // Insert into target shard
    const keys = Object.keys(data[0]);
    const columns = keys.join(', ');

    for (const row of data) {
      const values = keys.map((key) => `'${row[key]}'`).join(', ');
      await this.dataSourceManager.query(
        targetShard,
        `INSERT INTO ${table} (${columns}) VALUES (${values})`,
      );
    }

    // Delete from source shard
    await this.dataSourceManager.query(
      sourceShard,
      `DELETE FROM ${table} ${filter ? `WHERE ${filter}` : ''}`,
    );

    const duration = Date.now() - startTime;
    this.logger.log(`Rebalanced ${data.length} rows in ${duration}ms`);

    return { rowsMoved: data.length, duration };
  }

  /**
   * Split a shard into two
   */
  async splitShard(
    sourceShard: string,
    newShard1: string,
    newShard2: string,
    _keyField: string,
  ): Promise<void> {
    this.logger.log(`Splitting shard ${sourceShard} into ${newShard1} and ${newShard2}`);

    // Note: This requires copying data and updating the hash ring
    throw new Error('Shard splitting requires full reconfiguration');
  }

  /**
   * Merge two shards
   */
  async mergeShards(shard1: string, shard2: string, _keyField: string): Promise<void> {
    this.logger.log(`Merging shards ${shard1} and ${shard2}`);

    // Note: This requires copying data and updating the hash ring
    throw new Error('Shard merging requires full reconfiguration');
  }

  /**
   * Get shard statistics
   */
  async getShardStats(): Promise<{
    [shardId: string]: {
      rowCount: Record<string, number>;
      size: string;
      health: any;
    };
  }> {
    const shardIds = this.shardRouter.getAllShards();
    const stats: any = {};

    for (const shardId of shardIds) {
      try {
        // Get table counts
        const tableStats = await this.dataSourceManager.query(
          shardId,
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
        );

        const rowCounts: Record<string, number> = {};

        for (const table of tableStats) {
          const count = await this.dataSourceManager.query(
            shardId,
            `SELECT COUNT(*) as count FROM ${table.table_name}`,
          );
          rowCounts[table.table_name] = parseInt(count[0].count, 10) || 0;
        }

        // Get database size
        const size = await this.dataSourceManager.query(
          shardId,
          'SELECT pg_size_pretty(pg_database_size(current_database())) as size',
        );

        // Get health
        const health = await this.dataSourceManager.getShardHealth(shardId);

        stats[shardId] = {
          rowCount: rowCounts,
          size: size[0]?.size || 'unknown',
          health,
        };
      } catch (error) {
        this.logger.error(`Failed to get stats for shard ${shardId}:`, error);
        stats[shardId] = {
          error: error.message,
          health: await this.dataSourceManager.getShardHealth(shardId),
        };
      }
    }

    return stats;
  }

  /**
   * Get cluster health
   */
  async getClusterHealth() {
    return this.queryCoordinator.getClusterHealth();
  }

  /**
   * Get shard distribution
   */
  getDistribution() {
    return this.shardRouter.getDistribution();
  }

  /**
   * Migrate data between shards
   */
  async migrateData(
    sourceShard: string,
    targetShard: string,
    tables: string[],
  ): Promise<{ migratedRows: number; duration: number }> {
    const startTime = Date.now();
    let totalRows = 0;

    for (const table of tables) {
      const { rowsMoved } = await this.rebalanceShards(sourceShard, targetShard, table, 'id');
      totalRows += rowsMoved;
    }

    const duration = Date.now() - startTime;

    return { migratedRows: totalRows, duration };
  }

  /**
   * Update shard status
   */
  updateShardStatus(shardId: string, status: 'active' | 'inactive' | 'maintenance'): void {
    this.shardRouter.updateShardStatus(shardId, status);
    this.logger.log(`Updated shard ${shardId} status to ${status}`);
  }

  /**
   * Add explicit shard mapping
   */
  addShardMapping(key: string, shardId: string): void {
    this.shardRouter.addMapping(key, shardId);
  }

  /**
   * Remove shard mapping
   */
  removeShardMapping(key: string): void {
    this.shardRouter.removeMapping(key);
  }
}
