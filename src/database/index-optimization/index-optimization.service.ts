import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  resolveIndexOptimizationConfig,
  IndexOptimizationConfig,
} from './index-optimization.config';
import { QueryAnalysisService } from './services/query-analysis.service';
import { IndexCreationService } from './services/index-creation.service';
import { IndexUsageMonitorService } from './services/index-usage-monitor.service';
import { StaleIndexService } from './services/stale-index.service';
import { IOptimizationRunSummary } from './interfaces/index-optimization.interfaces';

/**
 * Orchestrates a full index-optimization cycle:
 *   analyse → create recommended → monitor usage → remove stale
 *
 * Runs on a weekly schedule when INDEX_OPT_ENABLED=true, and can be triggered
 * on demand via the controller. Each stage independently respects the dry-run
 * and auto-create / auto-drop flags so an operator can dial in exactly how much
 * autonomy the optimizer has.
 */
@Injectable()
export class IndexOptimizationService {
  private readonly logger = new Logger(IndexOptimizationService.name);
  private readonly config: IndexOptimizationConfig;
  private lastRun?: IOptimizationRunSummary;

  constructor(
    private readonly analysis: QueryAnalysisService,
    private readonly creation: IndexCreationService,
    private readonly usageMonitor: IndexUsageMonitorService,
    private readonly staleIndex: StaleIndexService,
    config?: IndexOptimizationConfig,
  ) {
    this.config = config ?? resolveIndexOptimizationConfig();
  }

  /** Scheduled weekly run; no-op unless explicitly enabled. */
  @Cron(CronExpression.EVERY_WEEK)
  async scheduledRun(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.debug('Index optimizer disabled (INDEX_OPT_ENABLED=false)');
      return;
    }
    this.logger.log('Starting scheduled index optimization cycle');
    await this.run();
  }

  /**
   * Execute a full cycle.
   * @param force when true, applies DDL even if config is dry-run (used by the
   *   manual "apply" endpoint). Auto-create/auto-drop flags still gate
   *   destructive vs additive actions.
   */
  async run(force = false): Promise<IOptimizationRunSummary> {
    const startedAt = new Date().toISOString();

    // 1. Query analysis → recommendations.
    const recommendations = await this.analysis.analyze();

    // 2. Index creation (additive). Gated by autoCreate; dry-run unless forced.
    const createDryRun = force ? false : this.config.dryRun || !this.config.autoCreate;
    const created = await this.creation.createFromRecommendations(
      recommendations,
      createDryRun,
    );

    // 3. Usage monitoring snapshot (read-only).
    await this.usageMonitor.sample();

    // 4. Stale index removal (destructive). Gated by autoDropStale.
    const dropDryRun = force ? false : this.config.dryRun || !this.config.autoDropStale;
    const removedStale = await this.staleIndex.removeStaleIndexes(dropDryRun);

    const summary: IOptimizationRunSummary = {
      startedAt,
      finishedAt: new Date().toISOString(),
      dryRun: createDryRun && dropDryRun,
      recommendations,
      created,
      removedStale,
    };

    this.lastRun = summary;
    this.logger.log(
      `Index optimization complete: ${recommendations.length} recommendation(s), ` +
        `${created.filter((c) => c.created).length} created, ` +
        `${removedStale.filter((r) => r.dropped).length} stale removed`,
    );
    return summary;
  }

  /** Return the summary of the most recent run, if any. */
  getLastRun(): IOptimizationRunSummary | undefined {
    return this.lastRun;
  }
}
