import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QuotaTrackingService } from './quota-tracking.service';

/**
 * Scheduled jobs that reset expired quota windows.
 * Each job only deletes rows whose windowEnd has passed — no data loss risk.
 */
@Injectable()
export class QuotaResetScheduler {
  private readonly logger = new Logger(QuotaResetScheduler.name);

  constructor(private readonly tracking: QuotaTrackingService) {}

  /** Run every minute — cleans up expired per-minute windows */
  @Cron(CronExpression.EVERY_MINUTE)
  async resetMinutelyWindows(): Promise<void> {
    const count = await this.tracking.resetExpiredWindows('MINUTELY');
    if (count > 0) this.logger.debug(`Cleared ${count} expired MINUTELY quota windows`);
  }

  /** Run every hour — cleans up expired per-hour windows */
  @Cron(CronExpression.EVERY_HOUR)
  async resetHourlyWindows(): Promise<void> {
    const count = await this.tracking.resetExpiredWindows('HOURLY');
    if (count > 0) this.logger.log(`Cleared ${count} expired HOURLY quota windows`);
  }

  /** Run every day at midnight — cleans up expired per-day windows */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyWindows(): Promise<void> {
    const count = await this.tracking.resetExpiredWindows('DAILY');
    this.logger.log(`Daily quota reset complete — cleared ${count} windows`);
  }
}
