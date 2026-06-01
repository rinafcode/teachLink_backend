import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShardConfig, ShardStatus, ReadReplicaConfig } from './interfaces/shard.interface';

/**
 * ShardConfigService
 *
 * Loads shard topology from environment variables at startup.
 *
 * Environment variable convention:
 *   SHARD_COUNT=3
 *   SHARD_0_HOST=pg-shard-0.internal
 *   SHARD_0_PORT=5432
 *   SHARD_0_USER=teachlink
 *   SHARD_0_PASSWORD=secret
 *   SHARD_0_DB=teachlink_0
 *   SHARD_0_POOL_MAX=30
 *   SHARD_0_POOL_MIN=5
 *   SHARD_0_WEIGHT=100
 *   SHARD_0_REGION=us-east-1
 *   SHARD_0_STATUS=active
 *   SHARD_0_REPLICA_COUNT=1
 *   SHARD_0_REPLICA_0_HOST=pg-replica-0.internal
 *   SHARD_0_REPLICA_0_PORT=5432
 *   SHARD_0_REPLICA_0_WEIGHT=100
 *
 * If SHARD_COUNT is not set, the service falls back to a single-shard
 * configuration derived from the existing DATABASE_* variables so that
 * development environments require zero additional configuration.
 */
@Injectable()
export class ShardConfigService {
  private readonly logger = new Logger(ShardConfigService.name);
  private shards: Map<string, ShardConfig> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.loadShardConfiguration();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Return all shard configurations */
  getAllShards(): ShardConfig[] {
    return Array.from(this.shards.values());
  }

  /** Return only active (non-offline, non-draining) shards */
  getActiveShards(): ShardConfig[] {
    return this.getAllShards().filter(
      (s) => s.status === ShardStatus.ACTIVE || s.status === ShardStatus.REBALANCING,
    );
  }

  /** Lookup a single shard by ID */
  getShardById(id: string): ShardConfig | undefined {
    return this.shards.get(id);
  }

  /** Update a shard's status at runtime (e.g. during draining) */
  updateShardStatus(id: string, status: ShardStatus): void {
    const shard = this.shards.get(id);
    if (!shard) {
      this.logger.warn(`updateShardStatus: unknown shard "${id}"`);
      return;
    }
    shard.status = status;
    this.logger.log(`Shard "${id}" status → ${status}`);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private loadShardConfiguration(): void {
    const shardCount = parseInt(this.configService.get<string>('SHARD_COUNT', '0'), 10);

    if (shardCount === 0) {
      this.loadFallbackSingleShard();
      return;
    }

    for (let i = 0; i < shardCount; i++) {
      const shard = this.buildShardFromEnv(i);
      this.shards.set(shard.id, shard);
    }

    this.logger.log(`Loaded ${this.shards.size} shard(s) from environment configuration`);
  }

  private buildShardFromEnv(index: number): ShardConfig {
    const prefix = `SHARD_${index}`;

    const replicaCount = parseInt(
      this.configService.get<string>(`${prefix}_REPLICA_COUNT`, '0'),
      10,
    );
    const readReplicas: ReadReplicaConfig[] = [];

    for (let r = 0; r < replicaCount; r++) {
      readReplicas.push({
        id: `${prefix}-replica-${r}`,
        host: this.configService.get<string>(`${prefix}_REPLICA_${r}_HOST`, 'localhost'),
        port: parseInt(this.configService.get<string>(`${prefix}_REPLICA_${r}_PORT`, '5432'), 10),
        weight: parseInt(
          this.configService.get<string>(`${prefix}_REPLICA_${r}_WEIGHT`, '100'),
          10,
        ),
      });
    }

    const statusRaw = this.configService
      .get<string>(`${prefix}_STATUS`, ShardStatus.ACTIVE)
      .toLowerCase();

    return {
      id: `shard-${index.toString().padStart(2, '0')}`,
      name: this.configService.get<string>(`${prefix}_NAME`, `Shard ${index}`),
      host: this.configService.get<string>(`${prefix}_HOST`, 'localhost'),
      port: parseInt(this.configService.get<string>(`${prefix}_PORT`, '5432'), 10),
      username: this.configService.get<string>(`${prefix}_USER`, 'postgres'),
      password: this.configService.get<string>(`${prefix}_PASSWORD`, 'postgres'),
      database: this.configService.get<string>(`${prefix}_DB`, `teachlink_${index}`),
      poolMax: parseInt(this.configService.get<string>(`${prefix}_POOL_MAX`, '30'), 10),
      poolMin: parseInt(this.configService.get<string>(`${prefix}_POOL_MIN`, '5'), 10),
      weight: parseInt(this.configService.get<string>(`${prefix}_WEIGHT`, '100'), 10),
      region: this.configService.get<string>(`${prefix}_REGION`),
      status: (statusRaw as ShardStatus) ?? ShardStatus.ACTIVE,
      readReplicas: readReplicas.length ? readReplicas : undefined,
    };
  }

  /** Fall back to the legacy DATABASE_* variables as a single shard */
  private loadFallbackSingleShard(): void {
    const shard: ShardConfig = {
      id: 'shard-00',
      name: 'Default Shard',
      host: this.configService.get<string>('DATABASE_HOST', 'localhost'),
      port: parseInt(this.configService.get<string>('DATABASE_PORT', '5432'), 10),
      username: this.configService.get<string>('DATABASE_USER', 'postgres'),
      password: this.configService.get<string>('DATABASE_PASSWORD', 'postgres'),
      database: this.configService.get<string>('DATABASE_NAME', 'teachlink'),
      poolMax: parseInt(this.configService.get<string>('DATABASE_POOL_MAX', '30'), 10),
      poolMin: parseInt(this.configService.get<string>('DATABASE_POOL_MIN', '5'), 10),
      weight: 100,
      status: ShardStatus.ACTIVE,
    };

    this.shards.set(shard.id, shard);
    this.logger.log('SHARD_COUNT not set — running in single-shard (fallback) mode');
  }
}
