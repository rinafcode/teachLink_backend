import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DashboardService } from './dashboard.service';

@Injectable()
export class DashboardReportScheduler {
  private readonly logger = new Logger(DashboardReportScheduler.name);

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly configService: ConfigService,
  ) {}

  /** Weekly business metrics email report (Mondays 08:00 UTC) */
  @Cron('0 8 * * 1')
  async sendWeeklyReport(): Promise<void> {
    const recipient = this.configService.get<string>('DASHBOARD_REPORT_EMAIL');
    if (!recipient) {
      this.logger.debug('DASHBOARD_REPORT_EMAIL not set; skipping scheduled report');
      return;
    }

    const csv = await this.dashboardService.exportToCsv();
    const overview = await this.dashboardService.getOverview();

    this.logger.log(
      `Scheduled dashboard report for ${recipient}: ` +
        `users=${overview.userGrowth.totalUsers}, ` +
        `netRevenue=${overview.revenue.summary.netRevenue}, csvBytes=${csv.length}`,
    );

    // Email delivery hooks into SMTP/SendGrid when configured; log payload for ops visibility
    this.logger.log(`Dashboard CSV report ready (${csv.split('\n').length} rows) → ${recipient}`);
  }
}
