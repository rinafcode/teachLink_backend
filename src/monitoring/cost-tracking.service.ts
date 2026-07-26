import { Injectable, Logger } from '@nestjs/common';
import { Gauge } from 'prom-client';
import { MetricsCollectionService } from './metrics/metrics-collection.service';

/**
 * CostTrackingService
 * - Records real cloud-provider billing data into Prometheus metrics via MetricsCollectionService.
 * - Provides a simple in-memory rolling window and ability to evaluate budgets.
 */
@Injectable()
export class CostTrackingService {
  private readonly logger = new Logger(CostTrackingService.name);
  private windowHours = 24;
  private hourlyCosts: number[] = [];

  /** Lazily created gauge so we can add the billing_period label on first use. */
  private hourlyCostGauge: Gauge | null = null;

  constructor(private readonly metrics: MetricsCollectionService) {}

  /**
   * Records the hourly cost figure into the rolling window and updates the
   * Prometheus gauge `infrastructure_hourly_cost_usd`.
   *
   * @param amountUsd    Cost in USD for the billing period.
   * @param billingPeriod  ISO-8601 date range the amount covers, e.g.
   *                       "2026-07-25/2026-07-26".  Omit when the billing
   *                       period is unknown.
   */
  async recordHourlyCost(amountUsd: number, billingPeriod?: string): Promise<void> {
    // Maintain a rolling window of the last `windowHours` hourly costs.
    this.hourlyCosts.push(amountUsd);
    if (this.hourlyCosts.length > this.windowHours) {
      this.hourlyCosts.shift();
    }

    try {
      const gauge = this.getOrCreateGauge();
      const labels = billingPeriod ? { billing_period: billingPeriod } : { billing_period: 'unknown' };
      gauge.set(labels, amountUsd);
    } catch (err) {
      this.logger.error('Failed to record cost metric', err as Error);
    }
  }

  private getOrCreateGauge(): Gauge {
    if (!this.hourlyCostGauge) {
      const registry = this.metrics.getRegistry();
      const gaugeName = 'infrastructure_hourly_cost_usd';
      const existing = registry.getSingleMetric(gaugeName);
      if (existing) {
        this.hourlyCostGauge = existing as Gauge;
      } else {
        this.hourlyCostGauge = new Gauge({
          name: gaugeName,
          help: 'Hourly infrastructure cost in USD, labelled with the billing period it describes',
          labelNames: ['billing_period'],
          registers: [registry],
        });
      }
    }
    return this.hourlyCostGauge;
  }

  getLast24hCost(): number {
    return this.hourlyCosts.reduce((s, v) => s + v, 0);
  }

  getAverageHourlyCost(): number {
    if (this.hourlyCosts.length === 0) return 0;
    return this.hourlyCosts.reduce((s, v) => s + v, 0) / this.hourlyCosts.length;
  }

  evaluateBudget(thresholdUsd: number): boolean {
    const last24 = this.getLast24hCost();
    const exceeded = last24 > thresholdUsd;
    if (exceeded) {
      this.logger.warn(`Budget exceeded: last24h=${last24} threshold=${thresholdUsd}`);
    }
    return exceeded;
  }
}
