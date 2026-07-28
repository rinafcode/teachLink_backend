import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ShardConfigService } from '../shard-config.service';
import { ShardConfig, ShardStatus } from '../interfaces/shard.interface';

/**
 * ShardConnectionManager
 *
 * Manages a pool of TypeORM DataSources — one per shard.
 * Connections are created lazily on first access and cached for reuse.
 *
 * Usage:
 *   const ds = await manager.getConnection('shard-01');
 *   const result = await ds.query('SELECT ...');
 */
@Injectable()
export class ShardConnectionManager {
  private readonly logger = new Logger(ShardConnectionManager.name);
  /** Lazy cache: shardId → initialized DataSource */
  private readonly connections = new Map<string, DataSource>();

  constructor(private readonly shardConfigService: ShardConfigService) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get (or lazily create) a DataSource for the given shard.
   * @throws NotFoundException if shardId is unknown
   * @throws Error if the connection cannot be established
   */
  async getConnection(shardId: string): Promise<DataSource> {
    // Return cached connection if already initialised
    const cached = this.connections.get(shardId);
    if (cached?.isInitialized) return cached;

    const config = this.shardConfigService.getShardById(shardId);
    if (!config) {
      throw new NotFoundException(`No shard configuration found for id="${shardId}"`);
    }

    if (config.status === ShardStatus.OFFLINE) {
      throw new BadRequestException(`Shard "${shardId}" is offline and cannot accept connections`);
    }

    return this.createConnection(config);
  }

  /** Close and remove all connections (called on app shutdown) */
  async closeAll(): Promise<void> {
    const closingPromises: Promise<void>[] = [];

    for (const [id, ds] of this.connections.entries()) {
      if (ds.isInitialized) {
        this.logger.log(`Closing connection for shard "${id}"`);
        closingPromises.push(ds.destroy());
      }
    }

    await Promise.allSettled(closingPromises);
    this.connections.clear();
    this.logger.log('All shard connections closed');
  }

  /** Close the connection for a specific shard (e.g. before draining) */
  async closeConnection(shardId: string): Promise<void> {
    const ds = this.connections.get(shardId);
    if (ds?.isInitialized) {
      await ds.destroy();
      this.connections.delete(shardId);
      this.logger.log(`Connection for shard "${shardId}" closed`);
    }
  }

  /** Return the IDs of all currently initialized shard connections */
  getInitializedShardIds(): string[] {
    return Array.from(this.connections.entries())
      .filter(([, ds]) => ds.isInitialized)
      .map(([id]) => id);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async createConnection(config: ShardConfig): Promise<DataSource> {
    this.logger.log(
      `Initializing connection for shard "${config.id}" at ${config.host}:${config.port}`,
    );

    const options: DataSourceOptions = {
      type: 'postgres',
      name: config.id, // unique DataSource name
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      // Entities are auto-discovered; the caller is responsible for running
      // migrations on each shard via ShardMigrationService.
      entities: [],
      synchronize: false,
      logging: process.env.NODE_ENV !== 'production',
      extra: {
        max: config.poolMax,
        min: config.poolMin,
        connectionTimeoutMillis: parseInt(
          process.env.DATABASE_POOL_ACQUIRE_TIMEOUT_MS || '10000',
          10,
        ),
        idleTimeoutMillis: parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS || '30000', 10),
      },
    };

    const dataSource = new DataSource(options);

    try {
      await dataSource.initialize();
      this.connections.set(config.id, dataSource);
      this.logger.log(`Shard "${config.id}" connection established`);
      return dataSource;
    } catch (err) {
      this.logger.error(
        `Failed to connect to shard "${config.id}": ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }
}
