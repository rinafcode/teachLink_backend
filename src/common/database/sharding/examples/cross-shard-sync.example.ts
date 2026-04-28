import { Injectable, Logger } from '@nestjs/common';
import { ShardTransactionService, ShardDataSourceManager } from '../index';

/**
 * Example: Cross-Shard Data Synchronization
 * Demonstrates how to perform operations across multiple shards
 */
@Injectable()
export class ShardSyncExample {
  private readonly logger = new Logger(ShardSyncExample.name);

  constructor(
    private shardTransactionService: ShardTransactionService,
    private dataSourceManager: ShardDataSourceManager,
  ) {}

  /**
   * Synchronize user data across shards (e.g., broadcast admin users)
   */
  async syncAdminUsersToAllShards(adminData: any): Promise<any> {
    const allShards = this.getAvailableShards();
    const operations = allShards.map((shardId) => ({
      shardId,
      operation: async (manager: any) => {
        return manager.query(
          'INSERT INTO users (id, username, email, role, is_admin) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET role = $4, is_admin = $5',
          [adminData.id, adminData.username, adminData.email, adminData.role, true],
        );
      },
    }));

    return this.shardTransactionService.parallelShardOperations(operations);
  }

  /**
   * Aggregate statistics across all shards
   */
  async getGlobalStatistics(): Promise<{
    totalUsers: number;
    totalOrders: number;
    totalRevenue: number;
  }> {
    const userResults = await this.shardTransactionService.crossShardQuery(
      'SELECT COUNT(*) as count FROM users',
      { allShards: true, aggregationStrategy: 'aggregate' },
    );

    const orderResults = await this.shardTransactionService.crossShardQuery(
      'SELECT COUNT(*) as count FROM orders',
      { allShards: true, aggregationStrategy: 'aggregate' },
    );

    const revenueResults = await this.shardTransactionService.crossShardQuery(
      "SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE status = 'completed'",
      { allShards: true, aggregationStrategy: 'aggregate' },
    );

    return {
      totalUsers: parseInt((userResults[0] as any)?.count || '0', 10),
      totalOrders: parseInt((orderResults[0] as any)?.count || '0', 10),
      totalRevenue: parseFloat((revenueResults[0] as any)?.total || '0'),
    };
  }

  /**
   * Perform cross-shard search
   */
  async searchAcrossShards(keyword: string): Promise<any[]> {
    const searchQuery = `
      SELECT id, username, email, 'users' as type 
      FROM users 
      WHERE username ILIKE $1 OR email ILIKE $1
      UNION ALL
      SELECT id, title as username, '' as email, 'courses' as type 
      FROM courses 
      WHERE title ILIKE $1
    `;

    return this.shardTransactionService.crossShardQuery(searchQuery, {
      allShards: true,
      parameters: [`%${keyword}%`],
      aggregationStrategy: 'merge',
    });
  }

  /**
   * Replicate data to backup shard
   */
  async replicateToBackup(
    sourceShard: string,
    targetShard: string,
    tables: string[],
  ): Promise<void> {
    for (const table of tables) {
      const data = await this.dataSourceManager.query(sourceShard, `SELECT * FROM ${table}`);

      for (const record of data as any[]) {
        const { id, ...insertData } = record;
        const columns = Object.keys(insertData).join(', ');
        const values = Object.values(insertData);
        const placeholders = values.map((_: any, i: number) => `$${i + 1}`).join(', ');

        await this.dataSourceManager.query(
          targetShard,
          `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
          values,
        );
      }
    }
  }

  /**
   * Execute distributed transaction (e.g., transfer between tenants on different shards)
   */
  async executeDistributedTransfer(
    fromShardKey: string,
    toShardKey: string,
    amount: number,
  ): Promise<any> {
    return this.shardTransactionService.runCrossShard([
      {
        shardKey: fromShardKey,
        query: 'UPDATE accounts SET balance = balance - $1 WHERE user_id = $2',
        parameters: [amount, fromShardKey],
      },
      {
        shardKey: toShardKey,
        query: 'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2',
        parameters: [amount, toShardKey],
      },
    ]);
  }

  /**
   * Get shard health and distribution
   */
  async getShardHealthReport(): Promise<any> {
    return this.shardTransactionService.crossShardQuery(
      'SELECT 1 as status, pg_database_size(current_database()) as size',
      {
        allShards: true,
        aggregationStrategy: 'merge',
      },
    );
  }

  private getAvailableShards(): string[] {
    return this.dataSourceManager.getActiveShardIds();
  }
}
