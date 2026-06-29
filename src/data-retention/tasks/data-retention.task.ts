import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataRetentionService } from '../data-retention.service';
import { User } from '../../users/entities/user.entity';
import { Course } from '../../courses/entities/course.entity';
import { Enrollment } from '../../courses/entities/enrollment.entity';
import { Invoice } from '../../payments/entities/invoice.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Subscription } from '../../payments/entities/subscription.entity';

@Injectable()
export class DataRetentionTask {
  private readonly logger = new Logger(DataRetentionTask.name);

  constructor(private readonly retentionService: DataRetentionService) {}

  /**
   * Run data purge daily at 3 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyPurge(): Promise<void> {
    this.logger.log('Starting daily data purge and archive process...');

    try {
      // 1. Purge Audit Logs
      const auditLogsPurged = await this.retentionService.purgeAuditLogs();
      this.logger.log(`Purged ${auditLogsPurged} audit logs.`);

      // 2. Purge Notifications
      const notificationsPurged = await this.retentionService.purgeNotifications();
      this.logger.log(`Purged ${notificationsPurged} notifications.`);

      // 3. Purge Soft-Deleted records
      const entitiesToPurge = [
        { class: User, name: 'User' },
        { class: Course, name: 'Course' },
        { class: Enrollment, name: 'Enrollment' },
        { class: Invoice, name: 'Invoice' },
        { class: Payment, name: 'Payment' },
        { class: Subscription, name: 'Subscription' },
      ];

      for (const entity of entitiesToPurge) {
        const purgedCount = await this.retentionService.purgeSoftDeleted(entity.class, entity.name);
        if (purgedCount > 0) {
          this.logger.log(`Purged ${purgedCount} soft-deleted ${entity.name} records.`);
        }
      }

      this.logger.log('Daily data purge process completed successfully.');
    } catch (error) {
      this.logger.error('Error during daily data purge process:', error.stack);
    }
  }
}
