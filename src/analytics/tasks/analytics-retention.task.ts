import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Counter } from 'prom-client';
import { AnalyticsEvent } from '../entities/event.entity';
import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AnalyticsRetentionTask {
  private readonly logger = new Logger(AnalyticsRetentionTask.name);
  private readonly retentionDays: number;
  private readonly batchSize = 1000;
  private deletedCounter: Counter<'table'>;

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly eventRepository: Repository<AnalyticsEvent>,
    private readonly configService: ConfigService,
    private readonly metrics: MetricsCollectionService,
  ) {
    this.retentionDays = this.configService.get<number>('ANALYTICS_RETENTION_DAYS', 365);
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

  @Cron('30 2 * * *')
  async handleDailyRetention(): Promise<void> {
    this.logger.log('Starting daily analytics event retention policy...');
    let totalDeleted = 0;
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - this.retentionDays);

      let deleted = 0;
      do {
        const eventsToDelete = await this.eventRepository.find({
          select: ['id'],
          where: { timestamp: LessThan(cutoff) },
          take: this.batchSize,
        });

        if (eventsToDelete.length === 0) {
          deleted = 0;
          break;
        }

        const idValues = eventsToDelete.map((e) => e.id);
        const result = await this.eventRepository
          .createQueryBuilder()
          .delete()
          .from(AnalyticsEvent)
          .whereInIds(idValues)
          .execute();
        deleted = result.affected || 0;
        totalDeleted += deleted;
      } while (deleted >= this.batchSize);

      this.deletedCounter.inc({ table: 'analytics_events' }, totalDeleted);
      this.logger.log(
        `Daily analytics retention policy completed. Deleted ${totalDeleted} old events.`,
      );
    } catch (error) {
      this.logger.error('Failed to apply analytics retention policy:', error);
    }
  }
}
