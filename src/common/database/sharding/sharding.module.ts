import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { shardConfig } from './config/shard.config';
import { ShardRouter } from './router/shard.router';
import { ShardDataSourceManager } from './datasource/shard-datasource.manager';
import { CrossShardQueryCoordinator } from './coordinator/cross-shard-query-coordinator';
import { ShardAwareQueryRunner } from './runner/shard-aware-query-runner';
import { ShardHash } from './hash/shard.hash';

/**
 * Database Sharding Module
 *
 * Implements database sharding with:
 * - Shard routing using consistent hashing
 * - Data distribution across multiple shards
 * - Cross-shard query coordination
 * - Shard-aware connection management
 */
@Global()
@Module({
  imports: [ConfigModule.forFeature(shardConfig)],
  providers: [
    {
      provide: ShardHash,
      useFactory: (config: any) => {
        const shards = Object.keys(config.shards);
        const weights = new Map<string, number>();
        for (const [shardId, shard] of Object.entries(config.shards)) {
          weights.set(shardId, (shard as any).weight);
        }
        return new ShardHash(shards, weights, config.virtualNodesPerShard);
      },
      inject: ['sharding'],
    },
    {
      provide: ShardRouter,
      useFactory: (config: any) => {
        return new ShardRouter(config);
      },
      inject: ['sharding'],
    },
    {
      provide: ShardDataSourceManager,
      useFactory: (config: any, _shardRouter: ShardRouter) => {
        const shardConfigs = new Map<string, any>();
        for (const [shardId, shard] of Object.entries(config.shards)) {
          shardConfigs.set(shardId, shard);
        }
        return new ShardDataSourceManager(shardConfigs);
      },
      inject: ['sharding', ShardRouter],
    },
    {
      provide: CrossShardQueryCoordinator,
      useFactory: (_shardRouter: ShardRouter, dataSourceManager: ShardDataSourceManager) => {
        return new CrossShardQueryCoordinator(_shardRouter, dataSourceManager);
      },
      inject: [ShardRouter, ShardDataSourceManager],
    },
    {
      provide: ShardAwareQueryRunner,
      useFactory: (dataSourceManager: ShardDataSourceManager) => {
        return new ShardAwareQueryRunner(dataSourceManager);
      },
      inject: [ShardDataSourceManager],
    },
  ],
  exports: [
    ShardHash,
    ShardRouter,
    ShardDataSourceManager,
    CrossShardQueryCoordinator,
    ShardAwareQueryRunner,
  ],
})
export class ShardingModule {}
