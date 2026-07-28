import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RebalancePlan, ShardMigrationPlan, ShardStatus } from '../interfaces/shard.interface';
import { ShardConfigService } from '../shard-config.service';
import { ShardRouter } from '../router/shard-router.service';
import { ShardMigrationService } from '../migration/shard-migration.service';
import { ShardHealthService } from '../health/shard-health.service';

/**
 * ShardRebalanceService
 *
 * Monitors shard utilisation and orchestrates automatic or manual rebalancing.
 *
 * Rebalancing algorithm:
 *  1. Query ShardHealthService for per-shard metrics.
 *  2. Identify over-loaded shards (poolUtilisation > HIGH_WATERMARK).
 *  3. Identify under-loaded shards (poolUtilisation < LOW_WATERMARK).
 *  4. For each overloaded shard, generate ShardMigrationPlan(s) targeting
 *     under-loaded shards.
 *  5. Submit plans to ShardMigrationService and rebuild the hash ring.
 *
 * Thresholds are configurable via environment variables:
 *   SHARD_REBALANCE_HIGH_WATERMARK  (default: 80)  — % pool utilisation
 *   SHARD_REBALANCE_LOW_WATERMARK   (default: 20)  — % pool utilisation
 *   SHARD_REBALANCE_BATCH_SIZE      (default: 500) — rows per batch
 */
@Injectable()
export class ShardRebalanceService {
  private readonly logger = new Logger(ShardRebalanceService.name);

  private readonly HIGH_WATERMARK = parseInt(
    process.env.SHARD_REBALANCE_HIGH_WATERMARK || '80',
    10,
  );
  private readonly LOW_WATERMARK = parseInt(process.env.SHARD_REBALANCE_LOW_WATERMARK || '20', 10);
  private readonly DEFAULT_BATCH_SIZE = parseInt(
    process.env.SHARD_REBALANCE_BATCH_SIZE || '500',
    10,
  );

  /** In-memory plan history; swap for a persistent store in production */
  private readonly plans = new Map<string, RebalancePlan>();

  constructor(
    private readonly shardConfigService: ShardConfigService,
    private readonly shardRouter: ShardRouter,
    private readonly migrationService: ShardMigrationService,
    private readonly healthService: ShardHealthService,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Analyse shard health and generate rebalance migration plans if thresholds
   * are exceeded. Set `autoExecute=true` to immediately submit the plans.
   */
  async analyzeAndRebalance(entityTypes: string[], autoExecute = false): Promise<RebalancePlan> {
    const allHealth = await this.healthService.checkAllShards();

    const overloaded = allHealth.filter(
      (h) => h.status === ShardStatus.ACTIVE && h.poolUtilizationPercent >= this.HIGH_WATERMARK,
    );

    const underloaded = allHealth.filter(
      (h) => h.status === ShardStatus.ACTIVE && h.poolUtilizationPercent <= this.LOW_WATERMARK,
    );

    if (overloaded.length === 0) {
      this.logger.log('Rebalance analysis: all shards within acceptable thresholds');
    } else {
      this.logger.warn(
        `Rebalance needed: ${overloaded.length} overloaded shard(s), ` +
          `${underloaded.length} underloaded shard(s)`,
      );
    }

    const migrations: ShardMigrationPlan[] = [];

    for (const source of overloaded) {
      const target = underloaded.find((u) => u.shardId !== source.shardId);
      if (!target) {
        this.logger.warn(`No suitable target found for overloaded shard "${source.shardId}"`);
        continue;
      }

      for (const entityType of entityTypes) {
        migrations.push({
          sourceShardId: source.shardId,
          targetShardId: target.shardId,
          entityType,
          // Estimated rows to move: size proportional to imbalance
          estimatedRowCount: Math.floor(
            ((source.poolUtilizationPercent - this.HIGH_WATERMARK) / 100) * 50_000,
          ),
          batchSize: this.DEFAULT_BATCH_SIZE,
          dryRun: !autoExecute,
        });
      }
    }

    const plan: RebalancePlan = {
      id: uuidv4(),
      triggeredBy: 'auto',
      migrations,
      createdAt: new Date(),
      progress: 0,
    };

    this.plans.set(plan.id, plan);

    if (autoExecute && migrations.length > 0) {
      await this.executePlan(plan);
    }

    return plan;
  }

  /**
   * Manually trigger a rebalance plan with explicit source → target mappings.
   * Useful for operator-driven shard splits or merges.
   */
  async triggerManualRebalance(
    migrations: ShardMigrationPlan[],
    dryRun = false,
  ): Promise<RebalancePlan> {
    const plan: RebalancePlan = {
      id: uuidv4(),
      triggeredBy: 'manual',
      migrations: migrations.map((m) => ({ ...m, dryRun })),
      createdAt: new Date(),
      progress: 0,
    };

    this.plans.set(plan.id, plan);
    await this.executePlan(plan);

    return plan;
  }

  /** Get a rebalance plan by its ID */
  getPlan(planId: string): RebalancePlan | undefined {
    return this.plans.get(planId);
  }

  /** List all rebalance plans */
  listPlans(): RebalancePlan[] {
    return Array.from(this.plans.values());
  }

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------

  private async executePlan(plan: RebalancePlan): Promise<void> {
    this.logger.log(
      `Executing rebalance plan "${plan.id}" with ${plan.migrations.length} migration(s)`,
    );

    const planIds: string[] = [];
    for (const migration of plan.migrations) {
      const planId = await this.migrationService.startMigration(migration);
      planIds.push(planId);
    }

    // Poll until all migrations complete, then rebuild the ring
    await this.waitForMigrations(plan.id, planIds);
    this.shardRouter.rebuildRing();

    this.logger.log(`Rebalance plan "${plan.id}" completed — hash ring rebuilt`);
  }

  private async waitForMigrations(planId: string, migrationIds: string[]): Promise<void> {
    const plan = this.plans.get(planId)!;
    const terminal = new Set(['completed', 'failed', 'rolled_back']);

    const isWaiting = true;
    while (isWaiting) {
      const statuses = migrationIds.map((id) => this.migrationService.getStatus(id));
      const done = statuses.filter((s) => terminal.has(s.status)).length;

      plan.progress = Math.round((done / migrationIds.length) * 100);

      if (done === migrationIds.length) break;

      await new Promise((r) => setTimeout(r, 2_000));
    }
  }
}
