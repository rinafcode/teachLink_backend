import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { ShardConfig } from '../config/shard.config';
import { Logger } from '@nestjs/common';

/**
 * Shard-aware DataSource Manager
 * Manages connections to multiple database shards
 */
export class ShardDataSourceManager {
  private readonly logger = new Logger(ShardDataSourceManager.name);
  private dataSources: Map<string, DataSource> = new Map();
  private queryRunners: Map<string, QueryRunner[]> = new Map();

  constructor(private shardConfigs: Map<string, ShardConfig>) {}

  /**
   * Initialize all shard data sources
   */
  async initialize(): Promise<void> {
    this.logger.log(`Initializing ${this.shardConfigs.size} shard data sources`);

    const initializationPromises = Array.from(this.shardConfigs.entries()).map(
      async ([shardId, config]) => {
        try {
          const dataSource = await this.createDataSource(config);
          this.dataSources.set(shardId, dataSource);
          this.queryRunners.set(shardId, []);
          this.logger.log(`Initialized shard ${shardId} (${config.name})`);
        } catch (error) {
          this.logger.error(`Failed to initialize shard ${shardId}:`, error);
          throw error;
        }
      },
    );

    await Promise.all(initializationPromises);
    this.logger.log('All shard data sources initialized successfully');
  }

  /**
   * Create a data source for a shard
   */
  private async createDataSource(config: ShardConfig): Promise<DataSource> {
    const dataSource = new DataSource({
      type: 'postgres',
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      synchronize: false,
      logging: true,
      logger: 'advanced-console',
      maxQueryExecutionTime: 1000,
      entities: [], // Entities should be registered via modules
      subscribers: [],
      migrations: [],
      extra: {
        max: config.maxConnections,
        min: config.minConnections,
        connectionTimeoutMillis: config.timeout,
        idleTimeoutMillis: 30000,
        // SSL configuration for production
        ssl:
          process.env.NODE_ENV === 'production'
            ? {
                rejectUnauthorized: false,
              }
            : undefined,
      },
    });

    await dataSource.initialize();
    return dataSource;
  }

  /**
   * Get the data source for a specific shard
   */
  getDataSource(shardId: string): DataSource | undefined {
    return this.dataSources.get(shardId);
  }

  /**
   * Get entity manager for a specific shard
   */
  getManager(shardId: string): EntityManager | undefined {
    const dataSource = this.dataSources.get(shardId);
    return dataSource?.manager;
  }

  /**
   * Execute a query on a specific shard
   */
  async query<T = any>(shardId: string, query: string, parameters?: any[]): Promise<T> {
    const dataSource = this.dataSources.get(shardId);
    if (!dataSource) {
      throw new Error(`Shard ${shardId} not found`);
    }

    return dataSource.query(query, parameters);
  }

  /**
   * Create a query runner for a specific shard
   */
  async createQueryRunner(shardId: string): Promise<QueryRunner> {
    const dataSource = this.dataSources.get(shardId);
    if (!dataSource) {
      throw new Error(`Shard ${shardId} not found`);
    }

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    const runners = this.queryRunners.get(shardId) || [];
    runners.push(queryRunner);
    this.queryRunners.set(shardId, runners);

    return queryRunner;
  }

  /**
   * Execute operation on a specific shard
   */
  async runOnShard<T>(
    shardId: string,
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const dataSource = this.dataSources.get(shardId);
    if (!dataSource) {
      throw new Error(`Shard ${shardId} not found`);
    }

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await operation(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute operation on multiple shards (cross-shard)
   */
  async runOnShards<T>(
    shardIds: string[],
    operation: (manager: EntityManager, shardId: string) => Promise<T>,
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    const errors: Error[] = [];

    for (const shardId of shardIds) {
      try {
        const result = await this.runOnShard(shardId, (manager) => operation(manager, shardId));
        results.set(shardId, result);
      } catch (error) {
        errors.push(new Error(`Shard ${shardId}: ${error.message}`));
      }
    }

    if (errors.length > 0 && results.size === 0) {
      throw new Error(`All shard operations failed: ${errors.map((e) => e.message).join(', ')}`);
    }

    return results;
  }

  /**
   * Get all active shard IDs
   */
  getActiveShardIds(): string[] {
    return Array.from(this.dataSources.keys());
  }

  /**
   * Check if a shard is available
   */
  isShardAvailable(shardId: string): boolean {
    const dataSource = this.dataSources.get(shardId);
    return dataSource?.isInitialized || false;
  }

  /**
   * Get shard health status
   */
  async getShardHealth(shardId: string): Promise<{
    available: boolean;
    latency?: number;
    activeConnections?: number;
  }> {
    const dataSource = this.dataSources.get(shardId);
    if (!dataSource) {
      return { available: false };
    }

    try {
      const startTime = Date.now();
      await dataSource.query('SELECT 1');
      const latency = Date.now() - startTime;

      return {
        available: true,
        latency,
      };
    } catch (_error) {
      return { available: false };
    }
  }

  /**
   * Close all shard connections
   */
  async destroy(): Promise<void> {
    const destroyPromises = Array.from(this.dataSources.entries()).map(
      async ([shardId, dataSource]) => {
        try {
          await dataSource.destroy();
          this.logger.debug(`Closed shard ${shardId}`);
        } catch (error) {
          this.logger.error(`Error closing shard ${shardId}:`, error);
        }
      },
    );

    await Promise.all(destroyPromises);
    this.dataSources.clear();
    this.queryRunners.clear();
    this.logger.log('All shard connections closed');
  }
}
