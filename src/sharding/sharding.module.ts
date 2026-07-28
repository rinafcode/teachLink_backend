import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ShardConfigService } from './shard-config.service';
import { ShardRouter } from './router/shard-router.service';
import { ShardConnectionManager } from './connection/shard-connection-manager.service';
import { ShardMigrationService } from './migration/shard-migration.service';
import { ShardRebalanceService } from './rebalance/shard-rebalance.service';
import { ShardHealthService } from './health/shard-health.service';
import { ShardingController } from './sharding.controller';

/**
 * ShardingModule
 *
 * Provides all sharding services as singletons within the application context.
 *
 * Import this module in AppModule (or any feature module that needs sharding):
 *
 *   imports: [ShardingModule]
 *
 * Then inject the desired service:
 *
 *   constructor(private readonly shardRouter: ShardRouter) {}
 *
 * Exports:
 *   - ShardRouter            (routing decisions)
 *   - ShardConnectionManager (per-shard DataSource access)
 *   - ShardConfigService     (shard topology)
 *   - ShardHealthService     (health checks)
 *   - ShardMigrationService  (cross-shard data migration)
 *   - ShardRebalanceService  (automated + manual rebalancing)
 */
@Module({
  imports: [ConfigModule],
  controllers: [ShardingController],
  providers: [
    ShardConfigService,
    ShardRouter,
    ShardConnectionManager,
    ShardMigrationService,
    ShardRebalanceService,
    ShardHealthService,
  ],
  exports: [
    ShardConfigService,
    ShardRouter,
    ShardConnectionManager,
    ShardMigrationService,
    ShardRebalanceService,
    ShardHealthService,
  ],
})
export class ShardingModule {}
