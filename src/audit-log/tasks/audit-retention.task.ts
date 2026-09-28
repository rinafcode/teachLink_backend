import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Counter } from 'prom-client';
import { AuditLog } from '../audit-log.entity';
import { AuditLogService } from '../audit-log.service';
import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuditRetentionTask {
  private readonly logger = new Logger(AuditRetentionTask.name);
  private readonly retentionDays: number;
  private readonly batchSize = 1000;
  private deletedCounter: Counter<'table'>;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
    private readonly metrics: MetricsCollectionService,
  ) {
    this.retentionDays = this.configService.get<number>('AUDIT_LOG_RETENTION_DAYS', 730);
    const registry = this.metrics.getRegistry();
    this.deletedCounter =
      (registry.getSingleMetric('deleted_count') as Counter<'table'>) ??
      new Counter({
        name: 'deleted_count',
        help: 'Number of rows deleted by data retention policies',
        labelNames: ['table'] as const,
        registers: [registry],
      });
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyRetention(): Promise<void> {
    this.logger.log('Starting daily audit log retention policy...');
    let totalDeleted = 0;
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - this.retentionDays);

      let deleted = 0;
      do {
        const logsToDelete = await this.auditLogRepo.find({
          select: ['id'],
          where: { timestamp: LessThan(cutoff) },
          take: this.batchSize,
        });

        if (logsToDelete.length === 0) {
          deleted = 0;
          break;
        }

        const idValues = logsToDelete.map((l) => l.id);
        const result = await this.auditLogRepo
          .createQueryBuilder()
          .delete()
          .from(AuditLog)
          .whereInIds(idValues)
          .execute();
        deleted = result.affected || 0;
        totalDeleted += deleted;
      } while (deleted >= this.batchSize);

      this.deletedCounter.inc({ table: 'audit_logs' }, totalDeleted);
      this.logger.log(`Daily retention policy completed. Deleted ${totalDeleted} old audit logs.`);
    } catch (error) {
      this.logger.error('Failed to apply retention policy:', error);
    }
  }

  @Cron('0 3 * * 1')
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
    } catch (error) {
      this.logger.error('Failed to generate weekly report:', error);
    }
  }
}
