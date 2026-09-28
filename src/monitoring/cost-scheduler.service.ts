import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Counter } from 'prom-client';
import { AwsCostCollectorService } from './cloud/aws-cost-collector.service';
import { CostTrackingService } from './cost-tracking.service';
import { MetricsCollectionService } from './metrics/metrics-collection.service';

/**
 * CostSchedulerService
 *
 * Drives the hourly cost collection cycle:
 *  1. Delegates the AWS Cost Explorer fetch to {@link AwsCostCollectorService}.
 *  2. On success, records the real amount and billing period via
 *     {@link CostTrackingService}.
 *  3. On failure (collector returns `null`), leaves the previous metric value
 *     unchanged and increments the `cost_collection_failures_total` counter so
 *     the outage is visible in dashboards and alerts.
 */
@Injectable()
export class CostSchedulerService {
  private readonly logger = new Logger(CostSchedulerService.name);

  /** Counts how many hourly collection cycles have failed since startup. */
  private readonly collectionFailures: Counter;

  constructor(
    private readonly costCollector: AwsCostCollectorService,
    private readonly costService: CostTrackingService,
    metricsService: MetricsCollectionService,
  ) {
    this.collectionFailures = new Counter({
      name: 'cost_collection_failures_total',
      help: 'Total number of hourly cost collection cycles that failed to retrieve data from the cloud provider',
      registers: [metricsService.getRegistry()],
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async recordHourlyCost(): Promise<void> {
    const result = await this.costCollector.collectHourlyCost();

    if (result === null) {
      // The collector encountered an error or is disabled — do not publish a
      // fabricated value.  Increment the failure counter so monitoring rules
      // can alert when collections are consistently missing.
      this.collectionFailures.inc();
      this.logger.warn(
        'Hourly cost collection failed — metric not updated; previous value retained',
      );
      return;
    }

    await this.costService.recordHourlyCost(result.amount, result.billingPeriod);
    this.logger.log(
      `Recorded hourly cost: $${result.amount.toFixed(4)} (billing period: ${result.billingPeriod})`,
    );
  }
}
