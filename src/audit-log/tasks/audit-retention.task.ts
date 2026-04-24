import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditLogService } from '../audit-log.service';

/**
 * Provides audit Retention Task behavior.
 */
@Injectable()
export class AuditRetentionTask {
  private readonly logger = new Logger(AuditRetentionTask.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Run retention policy daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyRetention(): Promise<void> {
    this.logger.log('Starting daily audit log retention policy...');
    try {
      const deletedCount = await this.auditLogService.applyRetentionPolicy();
      this.logger.log(`Daily retention policy completed. Deleted ${deletedCount} old audit logs.`);
    } catch (error) {
      this.logger.error('Failed to apply retention policy:', error);
    }
  }

  /**
   * Generate weekly report every Monday at 3 AM
   */
  @Cron('0 3 * * 1') // Every Monday at 3 AM
  async handleWeeklyReport(): Promise<void> {
    this.logger.log('Generating weekly audit report...');
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const report = await this.auditLogService.generateReport(startDate, endDate);

      this.logger.log('Weekly report generated:', {
        totalEvents: report.totalEvents,
        criticalEvents: report.eventsBySeverity['CRITICAL'] || 0,
        errorEvents: report.eventsBySeverity['ERROR'] || 0,
      });

      // In a real implementation, you might send this report via email
      // or store it for compliance purposes
    } catch (error) {
      this.logger.error('Failed to generate weekly report:', error);
    }
  }
}
