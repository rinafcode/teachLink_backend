import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ShardRouter } from './router/shard-router.service';
import { ShardConfigService } from './shard-config.service';
import { ShardMigrationService } from './migration/shard-migration.service';
import { ShardRebalanceService } from './rebalance/shard-rebalance.service';
import { ShardHealthService } from './health/shard-health.service';
import { ShardMigrationPlan, ShardStrategy } from './interfaces/shard.interface';

class RouteShardDto {
  /** Routing key, e.g. a userId, tenantId, or courseId */
  key: string;
  /** Strategy override — defaults to HASH_BASED */
  strategy?: ShardStrategy;
  /** Route to read replica if true */
  forRead?: boolean;
}

class StartMigrationDto {
  sourceShardId: string;
  targetShardId: string;
  entityType: string;
  estimatedRowCount: number;
  batchSize: number;
  dryRun: boolean;
}

class ManualRebalanceDto {
  migrations: ShardMigrationPlan[];
  dryRun: boolean;
}

class AutoRebalanceDto {
  entityTypes: string[];
  autoExecute: boolean;
}

/**
 * ShardingController
 *
 * Operator API for the sharding subsystem. All endpoints require the
 * ADMIN role in production (add your AuthGuard / RolesGuard here).
 *
 * Routes:
 *   GET    /sharding/shards              — list all shard configs
 *   POST   /sharding/route               — resolve shard for a key
 *   GET    /sharding/health              — health of all shards
 *   GET    /sharding/health/:id          — health of one shard
 *   POST   /sharding/migrations          — start a data migration
 *   GET    /sharding/migrations          — list all migrations
 *   GET    /sharding/migrations/:planId  — get migration status
 *   DELETE /sharding/migrations/:planId  — roll back a migration
 *   POST   /sharding/rebalance           — manual rebalance
 *   POST   /sharding/rebalance/auto      — auto rebalance analysis
 *   GET    /sharding/rebalance/plans     — list rebalance plans
 *   POST   /sharding/reload              — reload shard config and hash ring
 *   POST   /sharding/ring/rebuild        — rebuild consistent-hash ring
 */
@ApiTags('sharding')
@Controller('sharding')
export class ShardingController {
  private readonly logger = new Logger(ShardingController.name);

  constructor(
    private readonly shardRouter: ShardRouter,
    private readonly shardConfigService: ShardConfigService,
    private readonly migrationService: ShardMigrationService,
    private readonly rebalanceService: ShardRebalanceService,
    private readonly healthService: ShardHealthService,
  ) {}

  // ── Shard Configuration ──────────────────────────────────────────────────

  @Get('shards')
  @ApiOperation({ summary: 'List all configured shards' })
  @ApiResponse({ status: 200, description: 'Array of shard configurations' })
  listShards() {
    return {
      shards: this.shardConfigService.getAllShards(),
      count: this.shardConfigService.getAllShards().length,
    };
  }

  // ── Routing ───────────────────────────────────────────────────────────────

  @Post('route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve which shard a key routes to' })
  @ApiResponse({ status: 200, description: 'Routing result with shard info and metadata' })
  route(@Body() dto: RouteShardDto) {
    const result = this.shardRouter.route(dto.key, dto.strategy, dto.forRead ?? false);
    return {
      shardId: result.shard.id,
      host: result.shard.host,
      port: result.shard.port,
      isReplica: result.isReplica,
      routingKey: result.routingKey,
      resolutionTimeMs: result.resolutionTimeMs,
    };
  }

  // ── Health ────────────────────────────────────────────────────────────────

  @Get('health')
  @ApiOperation({ summary: 'Health check all shards' })
  async healthAll() {
    const statuses = await this.healthService.checkAllShards();
    return { shards: statuses };
  }

  @Get('health/:id')
  @ApiOperation({ summary: 'Health check a single shard' })
  @ApiParam({ name: 'id', description: 'Shard ID, e.g. shard-00' })
  async healthOne(@Param('id') id: string) {
    return this.healthService.checkShard(id);
  }

  // ── Migrations ────────────────────────────────────────────────────────────

  @Post('migrations')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start a cross-shard data migration' })
  async startMigration(@Body() dto: StartMigrationDto) {
    const planId = await this.migrationService.startMigration(dto);
    return { planId, message: 'Migration started — poll /sharding/migrations/:planId for status' };
  }

  @Get('migrations')
  @ApiOperation({ summary: 'List all migration plans and their statuses' })
  listMigrations() {
    return { migrations: this.migrationService.listMigrations() };
  }

  @Get('migrations/:planId')
  @ApiOperation({ summary: 'Get the status of a specific migration plan' })
  getMigrationStatus(@Param('planId') planId: string) {
    return this.migrationService.getStatus(planId);
  }

  @Delete('migrations/:planId')
  @ApiOperation({ summary: 'Roll back a completed migration' })
  async rollbackMigration(@Param('planId') planId: string) {
    await this.migrationService.rollbackMigration(planId);
    return { message: `Migration "${planId}" rolled back` };
  }

  // ── Rebalancing ───────────────────────────────────────────────────────────

  @Post('rebalance')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger a manual shard rebalance' })
  async manualRebalance(@Body() dto: ManualRebalanceDto) {
    const plan = await this.rebalanceService.triggerManualRebalance(dto.migrations, dto.dryRun);
    return { planId: plan.id, plan };
  }

  @Post('rebalance/auto')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Run automated rebalance analysis (and optionally execute)' })
  async autoRebalance(@Body() dto: AutoRebalanceDto) {
    const plan = await this.rebalanceService.analyzeAndRebalance(
      dto.entityTypes,
      dto.autoExecute ?? false,
    );
    return { planId: plan.id, plan };
  }

  @Get('rebalance/plans')
  @ApiOperation({ summary: 'List all rebalance plans' })
  listRebalancePlans() {
    return { plans: this.rebalanceService.listPlans() };
  }

  // ── Hash Ring ─────────────────────────────────────────────────────────────

  @Post('reload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reload shard configuration and rebuild the consistent-hash ring' })
  async reloadConfig() {
    await this.shardRouter.reloadConfig();
    return { message: 'Shard configuration reloaded successfully' };
  }

  @Post('ring/rebuild')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force a rebuild of the consistent-hash ring' })
  rebuildRing() {
    this.shardRouter.rebuildRing();
    return { message: 'Consistent-hash ring rebuilt successfully' };
  }
}
