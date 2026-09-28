import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getSharedRedisClient } from '../config/cache.config';
import { ShardConfig, ShardStatus, ReadReplicaConfig } from './interfaces/shard.interface';

export const SHARD_CONFIG_UPDATED_CHANNEL = 'shard:config:updated';

type ShardConfigUpdateListener = (message?: string) => void | Promise<void>;

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
export class ShardConfigService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShardConfigService.name);
  private readonly reloadDeadlineMs = 5000;
  private shards: Map<string, ShardConfig> = new Map();
  private configUpdateSubscriber?: Redis;
  private readonly configUpdateListeners = new Set<ShardConfigUpdateListener>();

  constructor(private readonly configService: ConfigService) {
    this.loadShardConfiguration();
  }

  async onModuleInit(): Promise<void> {
    await this.subscribeToConfigUpdates();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.configUpdateSubscriber && this.configUpdateSubscriber.status !== 'end') {
      await this.configUpdateSubscriber.quit();
    }
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

  /**
   * Reload shard topology from the current configuration source.
   *
   * The map is rebuilt off to the side, then swapped in one assignment so
   * readers never observe a partially populated configuration.
   */
  reloadConfig(): ShardConfig[] {
    const nextShards = this.buildShardConfiguration();
    this.shards = nextShards;
    this.logger.log(`Reloaded ${this.shards.size} shard(s) from configuration`);
    return this.getAllShards();
  }

  /**
   * Register a listener for runtime shard config update events.
   * Returns an unsubscribe function for module teardown/tests.
   */
  onConfigUpdated(listener: ShardConfigUpdateListener): () => void {
    this.configUpdateListeners.add(listener);
    return () => this.configUpdateListeners.delete(listener);
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
    this.shards = this.buildShardConfiguration();
    this.logger.log(`Loaded ${this.shards.size} shard(s) from environment configuration`);
  }

  private buildShardConfiguration(): Map<string, ShardConfig> {
    const shards = new Map<string, ShardConfig>();
    const shardCount = parseInt(this.configService.get<string>('SHARD_COUNT', '0'), 10);

    if (shardCount === 0) {
      const fallbackShard = this.buildFallbackSingleShard();
      shards.set(fallbackShard.id, fallbackShard);
      return shards;
    }

    for (let i = 0; i < shardCount; i++) {
      const shard = this.buildShardFromEnv(i);
      shards.set(shard.id, shard);
    }

    return shards;
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
  private buildFallbackSingleShard(): ShardConfig {
    return {
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
  }

  private async subscribeToConfigUpdates(): Promise<void> {
    if (!this.isConfigReloadSubscriptionEnabled()) {
      this.logger.log('Shard config Redis reload subscription disabled');
      return;
    }

    try {
      this.configUpdateSubscriber = getSharedRedisClient(this.configService).duplicate();
      this.configUpdateSubscriber.on('error', (error) => {
        this.logger.warn(`Shard config Redis subscriber error: ${(error as Error).message}`);
      });
      this.configUpdateSubscriber.on('message', (channel, message) => {
        if (channel === SHARD_CONFIG_UPDATED_CHANNEL) {
          void this.notifyConfigUpdated(message);
        }
      });

      await this.configUpdateSubscriber.subscribe(SHARD_CONFIG_UPDATED_CHANNEL);
      this.logger.log(`Subscribed to Redis channel "${SHARD_CONFIG_UPDATED_CHANNEL}"`);
    } catch (error) {
      this.logger.warn(
        `Unable to subscribe to "${SHARD_CONFIG_UPDATED_CHANNEL}": ${(error as Error).message}`,
      );
    }
  }

  private isConfigReloadSubscriptionEnabled(): boolean {
    const configured = this.configService.get<string>('SHARD_CONFIG_RELOAD_SUBSCRIBE_ENABLED');
    if (configured !== undefined) {
      return configured.toLowerCase() !== 'false';
    }

    return process.env.NODE_ENV !== 'test';
  }

  private async notifyConfigUpdated(message?: string): Promise<void> {
    if (this.configUpdateListeners.size === 0) {
      this.logger.warn(
        `Received "${SHARD_CONFIG_UPDATED_CHANNEL}" but no shard config listeners are registered`,
      );
      return;
    }

    this.logger.log(`Received "${SHARD_CONFIG_UPDATED_CHANNEL}" event; reloading shard topology`);

    const timeout = setTimeout(() => {
      this.logger.warn(
        `Shard config reload listeners are still running after ${this.reloadDeadlineMs}ms`,
      );
    }, this.reloadDeadlineMs);

    try {
      await Promise.all(
        Array.from(this.configUpdateListeners).map(async (listener) => listener(message)),
      );
    } catch (error) {
      this.logger.error(
        `Shard config reload listener failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
