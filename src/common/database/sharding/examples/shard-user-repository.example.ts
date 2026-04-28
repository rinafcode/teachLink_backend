import { Injectable, Logger } from '@nestjs/common';
import { ShardRouter, CrossShardQueryCoordinator, ShardDataSourceManager } from '..';

/**
 * Example: Shard-Aware User Repository
 * Demonstrates how to use sharding for user data distribution
 */
@Injectable()
export class UserShardRepository {
  private readonly logger = new Logger(UserShardRepository.name);

  constructor(
    private shardRouter: ShardRouter,
    private dataSourceManager: ShardDataSourceManager,
    private queryCoordinator: CrossShardQueryCoordinator,
  ) {}

  /**
   * Add user to appropriate shard based on tenantId
   */
  async createUser(tenantId: string, userData: any): Promise<any> {
    const shardId = this.shardRouter.route(tenantId);
    const results = await this.dataSourceManager.query(
      shardId,
      `INSERT INTO users (tenant_id, username, email, created_at) 
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [tenantId, userData.username, userData.email],
    );
    return results[0];
  }

  /**
   * Find user by tenant (routes to correct shard)
   */
  async findByTenant(tenantId: string): Promise<any[]> {
    const shardId = this.shardRouter.route(tenantId);
    return this.dataSourceManager.query(shardId, 'SELECT * FROM users WHERE tenant_id = $1', [
      tenantId,
    ]);
  }

  /**
   * Get total user count across all shards
   */
  async getTotalUserCount(): Promise<number> {
    const results = await this.queryCoordinator.executeCrossShardQuery<{ count: string }>({
      query: 'SELECT COUNT(*) as count FROM users',
      allShards: true,
      aggregationStrategy: 'aggregate',
    });
    return parseInt(results[0]?.count || '0', 10);
  }

  /**
   * Find user across all shards (expensive - use only when necessary)
   */
  async findUserGlobally(userId: string): Promise<any | null> {
    const results = await this.queryCoordinator.executeCrossShardQuery({
      query: 'SELECT * FROM users WHERE id = $1',
      parameters: [userId],
      allShards: true,
      aggregationStrategy: 'first',
    });
    return results[0] || null;
  }

  /**
   * Query all users across shards with custom filter
   */
  async findActiveUsersAcrossShards(): Promise<any[]> {
    return this.queryCoordinator.executeCrossShardQuery({
      query:
        "SELECT * FROM users WHERE status = 'active' AND created_at > NOW() - INTERVAL '30 days'",
      allShards: true,
      aggregationStrategy: 'merge',
    });
  }
}
