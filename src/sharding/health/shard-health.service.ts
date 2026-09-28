import { Injectable, Logger } from '@nestjs/common';
import { ShardConnectionManager } from '../connection/shard-connection-manager.service';
import { ShardConfigService } from '../shard-config.service';
import { ShardHealthStatus, ShardStatus } from '../interfaces/shard.interface';

/**
 * ShardHealthService
 *
 * Performs lightweight health checks on each known shard:
 *  - Attempts a trivial query (`SELECT 1`) to verify connectivity
 *  - Reads pool utilisation from the DataSource's internal driver client
 *  - Reports error rate based on recent failures (simple counter, extend with
 *    a sliding window / Prometheus histogram in production)
 *
 * Exposed via ShardingController GET /sharding/health
 */
@Injectable()
export class ShardHealthService {
  private readonly logger = new Logger(ShardHealthService.name);
  private readonly errorCounts = new Map<string, number>();
  private readonly queryCounts = new Map<string, number>();

  constructor(
    private readonly connectionManager: ShardConnectionManager,
    private readonly shardConfigService: ShardConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Health-check all configured shards and return their statuses */
  async checkAllShards(): Promise<ShardHealthStatus[]> {
    const shards = this.shardConfigService.getAllShards();
    const results = await Promise.allSettled(shards.map((s) => this.checkShard(s.id)));

    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;

      const shardId = shards[i].id;
      this.logger.error(
        `Health check failed for shard "${shardId}": ${(r.reason as Error).message}`,
      );

      return {
        shardId,
        status: ShardStatus.OFFLINE,
        activeConnections: 0,
        poolUtilizationPercent: 0,
        avgQueryLatencyMs: -1,
        errorRatePercent: 100,
        lastCheckedAt: new Date(),
      } satisfies ShardHealthStatus;
    });
  }

  /** Health-check a single shard */
  async checkShard(shardId: string): Promise<ShardHealthStatus> {
    const config = this.shardConfigService.getShardById(shardId);
    const startMs = Date.now();

    try {
      const ds = await this.connectionManager.getConnection(shardId);
      await ds.query('SELECT 1');
      const latencyMs = Date.now() - startMs;

      this.incrementQueryCount(shardId);

      // Approximate pool utilisation — pg exposes totalCount/idleCount on the pool
      // Accessing driver internals is necessary here; TypeORM doesn't surface this.
      const driver = ds.driver as unknown as {
        master?: { totalCount?: number; idleCount?: number };
      };
      const total = driver?.master?.totalCount ?? config!.poolMax;
      const idle = driver?.master?.idleCount ?? config!.poolMin;
      const active = total - idle;
      const utilization = Math.round((active / config!.poolMax) * 100);

      const totalQueries = this.queryCounts.get(shardId) ?? 1;
      const errors = this.errorCounts.get(shardId) ?? 0;
      const errorRate = Math.round((errors / totalQueries) * 100);

      return {
        shardId,
        status: config!.status,
        activeConnections: active,
        poolUtilizationPercent: utilization,
        avgQueryLatencyMs: latencyMs,
        errorRatePercent: errorRate,
        lastCheckedAt: new Date(),
      };
    } catch (err) {
      this.incrementErrorCount(shardId);
      throw err;
    }
  }

  /** Record a query error for error-rate tracking */
  recordError(shardId: string): void {
    this.incrementErrorCount(shardId);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private incrementQueryCount(shardId: string): void {
    this.queryCounts.set(shardId, (this.queryCounts.get(shardId) ?? 0) + 1);
  }

  private incrementErrorCount(shardId: string): void {
    this.errorCounts.set(shardId, (this.errorCounts.get(shardId) ?? 0) + 1);
    this.incrementQueryCount(shardId);
  }
}
