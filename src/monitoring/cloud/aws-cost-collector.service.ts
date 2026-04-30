import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CostTrackingService } from '../cost-tracking.service';

/**
 * AWS Cost Explorer collector
 * - Requires @aws-sdk/client-cost-explorer and credentials with Cost Explorer read access.
 * - If the SDK or credentials aren't available, the service logs and no-ops.
 */
@Injectable()
export class AwsCostCollectorService {
  private readonly logger = new Logger(AwsCostCollectorService.name);
  private enabled = false;
  private client: any;

  constructor(private readonly costService: CostTrackingService) {
    // Try to lazily load the AWS Cost Explorer client
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
      const region = process.env.AWS_REGION || 'us-east-1';
      this.client = new CostExplorerClient({ region });
      this.enabled = true;
    } catch (err) {
      this.logger.warn('AWS Cost Explorer client not available — AWS cost collection disabled');
      this.enabled = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async collectHourlyCost() {
    if (!this.enabled) return;

    try {
      const now = new Date();
      const end = new Date(now.getTime());
      const start = new Date(now.getTime() - 1000 * 60 * 60); // last hour

      const params = {
        TimePeriod: {
          Start: start.toISOString().slice(0, 10),
          End: end.toISOString().slice(0, 10),
        },
        Granularity: 'HOURLY',
        Metrics: ['UnblendedCost'],
      };

      const { GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
      const cmd = new GetCostAndUsageCommand(params);
      const resp = await this.client.send(cmd);

      // Parse response: sum hourly amounts for the last hour (if available)
      // The response structure includes ResultsByTime[] with Metrics.UnblendedCost.Amount
      let amount = 0;
      const results = resp.ResultsByTime || [];
      for (const r of results) {
        const m = r?.Total?.UnblendedCost?.Amount;
        const v = parseFloat(m || '0');
        if (!Number.isNaN(v)) amount += v;
      }

      // If AWS returns zero, still record the metric so dashboards populate
      this.costService.recordHourlyCost(amount);
      this.logger.log(`Recorded AWS hourly cost: $${amount.toFixed(4)}`);
    } catch (err) {
      this.logger.error('Error collecting AWS cost', err as Error);
    }
  }
}
