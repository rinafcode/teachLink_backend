import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CostTrackingService } from './cost-tracking.service';

@Injectable()
export class CostSchedulerService {
  private readonly logger = new Logger(CostSchedulerService.name);

  constructor(private readonly costService: CostTrackingService) {}

  // Every hour record a placeholder cost (0) — replace with real cloud billing pull
  @Cron(CronExpression.EVERY_HOUR)
  async recordHourlyCost() {
    try {
      // TODO: Replace with real billing amount pulled from cloud provider API
      const estimatedHourlyCostUsd = 0;
      this.costService.recordHourlyCost(estimatedHourlyCostUsd);
      this.logger.debug(`Recorded hourly cost: $${estimatedHourlyCostUsd}`);
    } catch (err) {
      this.logger.error('Failed to record hourly cost', err as Error);
    }
  }
}
