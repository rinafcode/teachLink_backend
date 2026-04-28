import { Injectable, Logger } from '@nestjs/common';
import { ShardTransactionService } from '../index';

/**
 * Example: Shard-Aware Payment Processing
 * Demonstrates payment processing with shard routing based on tenant
 */
@Injectable()
export class ShardPaymentExample {
  private readonly logger = new Logger(ShardPaymentExample.name);

  constructor(private shardTransactionService: ShardTransactionService) {}

  /**
   * Process payment for a tenant (auto-routes to correct shard)
   */
  async processPayment(tenantId: string, userId: string, amount: number): Promise<any> {
    return this.shardTransactionService.runOnShard(tenantId, async (manager: any) => {
      // 1. Check tenant balance
      const tenant = await manager.query('SELECT balance FROM tenants WHERE id = $1 FOR UPDATE', [
        tenantId,
      ]);

      if (!tenant || tenant.length === 0) {
        throw new Error('Tenant not found');
      }

      if (tenant[0].balance < amount) {
        throw new Error('Insufficient tenant balance');
      }

      // 2. Deduct from tenant
      await manager.query('UPDATE tenants SET balance = balance - $1 WHERE id = $2', [
        amount,
        tenantId,
      ]);

      // 3. Create payment record
      const payment = await manager.query(
        `INSERT INTO payments (tenant_id, user_id, amount, status) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
        [tenantId, userId, amount, 'completed'],
      );

      this.logger.log(`Payment processed: ${payment[0].id}`);

      return payment[0];
    });
  }

  /**
   * Execute cross-tenant payment (between different shards)
   */
  async processCrossTenantPayment(
    fromTenantId: string,
    toTenantId: string,
    amount: number,
  ): Promise<any> {
    return this.shardTransactionService.runCrossShard([
      {
        shardKey: fromTenantId,
        query: 'UPDATE tenants SET balance = balance - $1 WHERE id = $2',
        parameters: [amount, fromTenantId],
      },
      {
        shardKey: toTenantId,
        query: 'UPDATE tenants SET balance = balance + $1 WHERE id = $2',
        parameters: [amount, toTenantId],
      },
    ]);
  }

  /**
   * Get payment report for a tenant
   */
  async getTenantPaymentReport(tenantId: string): Promise<any> {
    return this.shardTransactionService.runOnShard(tenantId, async (manager: any) => {
      const payments = await manager.query(
        'SELECT * FROM payments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100',
        [tenantId],
      );

      const total = await manager.query(
        "SELECT SUM(amount) as total FROM payments WHERE tenant_id = $1 AND status = 'completed'",
        [tenantId],
      );

      return {
        payments,
        totalAmount: total[0]?.total || 0,
      };
    });
  }

  /**
   * Get global payment statistics (across all shards)
   */
  async getGlobalPaymentStats(): Promise<any> {
    const count = await this.shardTransactionService.crossShardQuery(
      "SELECT COUNT(*) as count FROM payments WHERE status = 'completed'",
      { allShards: true, aggregationStrategy: 'aggregate' },
    );
    const total = await this.shardTransactionService.crossShardQuery(
      "SELECT SUM(amount) as total FROM payments WHERE status = 'completed'",
      { allShards: true, aggregationStrategy: 'aggregate' },
    );
    const avg = await this.shardTransactionService.crossShardQuery(
      "SELECT AVG(amount) as avg FROM payments WHERE status = 'completed'",
      { allShards: true, aggregationStrategy: 'aggregate' },
    );

    return {
      totalPayments: parseInt((count[0] as any)?.count || '0', 10),
      totalAmount: parseFloat((total[0] as any)?.total || '0'),
      averageAmount: parseFloat((avg[0] as any)?.avg || '0'),
    };
  }
}
