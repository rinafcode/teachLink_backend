import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * The result returned by a successful Cost Explorer fetch.
 * `billingPeriod` is the ISO-8601 date range that the amount covers,
 * formatted as "YYYY-MM-DD/YYYY-MM-DD" (start inclusive, end exclusive),
 * matching the TimePeriod convention used by Cost Explorer.
 */
export interface HourlyCostResult {
  /** Sum of UnblendedCost in USD for the queried period. */
  amount: number;
  /** ISO-8601 billing period: "YYYY-MM-DD/YYYY-MM-DD". */
  billingPeriod: string;
}

/**
 * AWS Cost Explorer collector.
 *
 * Fetches the previous hour's UnblendedCost from AWS Cost Explorer and returns
 * a {@link HourlyCostResult}.  The caller is responsible for recording the
 * metric; this service only fetches data.
 *
 * Requirements:
 *  - `@aws-sdk/client-cost-explorer` installed.
 *  - AWS credentials with `ce:GetCostAndUsage` permission.
 *  - `AWS_REGION` env var (defaults to `us-east-1`).
 *
 * If the SDK is unavailable or credentials are not configured, the service
 * marks itself disabled and `collectHourlyCost()` returns `null`.
 */
@Injectable()
export class AwsCostCollectorService implements OnModuleInit {
  private readonly logger = new Logger(AwsCostCollectorService.name);
  private enabled = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  async onModuleInit() {
    try {
      const { CostExplorerClient } = await import('@aws-sdk/client-cost-explorer');
      const region = process.env.AWS_REGION ?? 'us-east-1';
      this.client = new CostExplorerClient({ region });
      this.enabled = true;
    } catch (_err) {
      this.logger.warn('AWS Cost Explorer client not available — AWS cost collection disabled');
    }
  }

  /**
   * Fetches the previous hour's cost from AWS Cost Explorer.
   *
   * Returns a {@link HourlyCostResult} on success, or `null` when the
   * collector is disabled or the API call fails.  The caller should treat
   * `null` as a transient failure and **not** overwrite the last known metric.
   */
  async collectHourlyCost(): Promise<HourlyCostResult | null> {
    if (!this.enabled) {
      this.logger.debug('Cost collection skipped — collector is disabled');
      return null;
    }

    try {
      const now = new Date();
      // Cost Explorer date strings are YYYY-MM-DD; end is exclusive so we use
      // today's date and start is yesterday to capture the last 24-hour window.
      // For hourly granularity the API returns the window that covers "now - 1 h".
      const end = now.toISOString().slice(0, 10);
      const startDate = new Date(now.getTime() - 1000 * 60 * 60);
      const start = startDate.toISOString().slice(0, 10);

      const { GetCostAndUsageCommand, Granularity } = await import('@aws-sdk/client-cost-explorer');

      const cmd = new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: Granularity.HOURLY,
        Metrics: ['UnblendedCost'],
      });

      const resp = await this.client.send(cmd);

      // Sum all returned hourly buckets (typically one when start === end).
      let amount = 0;
      const results: unknown[] = resp.ResultsByTime ?? [];
      for (const r of results) {
        const row = r as Record<string, unknown>;
        const total = row?.Total as Record<string, unknown> | undefined;
        const raw = (total?.UnblendedCost as Record<string, unknown> | undefined)?.Amount;
        const v = parseFloat((raw as string) || '0');
        if (!Number.isNaN(v)) amount += v;
      }

      const billingPeriod = `${start}/${end}`;
      this.logger.debug(`Fetched AWS hourly cost: $${amount.toFixed(4)} for ${billingPeriod}`);
      return { amount, billingPeriod };
    } catch (err) {
      this.logger.error('Error fetching AWS cost from Cost Explorer', err as Error);
      return null;
    }
  }
}
