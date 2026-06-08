import { Injectable, Logger, Optional } from '@nestjs/common';
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
 * Orchestrates a full index-optimization cycle.
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
    @Optional() config?: IndexOptimizationConfig,
  ) {
    this.config = config ?? resolveIndexOptimizationConfig();
  }

  /** Scheduled weekly run; no-op unless explicitly enabled. */
  @Cron(CronExpression.EVERY_WEEK)
  async scheduledRun(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    await this.run();
  }

  /**
   * Execute a full cycle.
   */
  async run(force = false): Promise<IOptimizationRunSummary> {
    const startedAt = new Date().toISOString();

    const recommendations = await this.analysis.analyze();

    const createDryRun = force ? false : this.config.dryRun || !this.config.autoCreate;
    const created = await this.creation.createFromRecommendations(recommendations, createDryRun);

    await this.usageMonitor.sample();

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
    return summary;
  }

  getLastRun(): IOptimizationRunSummary | undefined {
    return this.lastRun;
  }
}
