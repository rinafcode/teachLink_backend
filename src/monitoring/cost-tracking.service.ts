import { Injectable, Logger } from '@nestjs/common';
import { MetricsCollectionService } from './metrics/metrics-collection.service';

/**
 * CostTrackingService
 * - Records estimated cost metrics (e.g., AWS spend) into Prometheus metrics via MetricsCollectionService.
 * - Provides a simple in-memory rolling window and ability to evaluate budgets.
 */
@Injectable()
export class CostTrackingService {
  private readonly logger = new Logger(CostTrackingService.name);
  private windowHours = 24;
  private hourlyCosts: number[] = [];

  constructor(private readonly metrics: MetricsCollectionService) {}

  recordHourlyCost(amountUsd: number): void {
    // maintain a rolling window of last `windowHours` hourly costs
    this.hourlyCosts.push(amountUsd);
    if (this.hourlyCosts.length > this.windowHours) {
      this.hourlyCosts.shift();
    }

    // Expose as a Gauge on the metrics registry using a generic name
    try {
      // Create or update a simple gauge on the registry
      const gaugeName = 'infrastructure_hourly_cost_usd';
      // Use prom-client directly to set the gauge if not present
      const registry = this.metrics.getRegistry();
      const existing = registry.getSingleMetric(gaugeName);
      const latest = amountUsd;
      if (existing) {
        // @ts-ignore - prom-client Metric has set
        existing.set(latest);
      } else {
        // Create a new gauge
        // Lazy require to avoid import ordering issues
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const prom = require('prom-client');
        const Gauge = prom.Gauge;
        new Gauge({ name: gaugeName, help: 'Hourly infrastructure cost in USD', registers: [registry] }).set(latest);
      }
    } catch (err) {
      this.logger.error('Failed to record cost metric', err as Error);
    }
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
