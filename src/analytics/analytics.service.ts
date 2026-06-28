import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent, EventType } from './entities/event.entity';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
import { EventBatchingService, ITrackEventDto } from './services/event-batching.service';
import { EventValidationService } from './services/event-validation.service';

@Injectable()
export class AnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsService.name);
  private featureEventsCounter: Counter<'category' | 'action' | 'eventType'> | null = null;
  private assessmentDuration: Histogram<'status'> | null = null;

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly eventRepository: Repository<AnalyticsEvent>,
    private readonly metrics: MetricsCollectionService,
    private readonly batchingService: EventBatchingService,
    private readonly validationService: EventValidationService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const registry = this.metrics.getRegistry();
      const prom = await import('prom-client');

      this.featureEventsCounter =
        (registry.getSingleMetric('feature_events_total') as Counter<
          'category' | 'action' | 'eventType'
        >) ??
        new prom.Counter({
          name: 'feature_events_total',
          help: 'Feature analytics events',
          labelNames: ['category', 'action', 'eventType'] as const,
          registers: [registry],
        });

      this.assessmentDuration =
        (registry.getSingleMetric('assessment_duration_seconds') as Histogram<'status'>) ??
        new prom.Histogram({
          name: 'assessment_duration_seconds',
          help: 'Time from attempt start to submission or timeout, in seconds',
          labelNames: ['status'] as const,
          buckets: [30, 60, 120, 300, 600, 1200, 1800],
          registers: [registry],
        });
    } catch (err) {
      this.logger.error('Failed to initialize analytics metrics', err as Error);
      this.featureEventsCounter = null;
      this.assessmentDuration = null;
    }
  }

  async trackEvent(dto: ITrackEventDto): Promise<void> {
    try {
      this.validationService.validateEventOrThrow(dto);

      const event = new AnalyticsEvent();
      event.eventType = dto.eventType;
      event.category = dto.category;
      event.action = dto.action;
      event.label = dto.label;
      event.value = dto.value;
      event.properties = dto.properties;
      event.userId = dto.userId;
      event.sessionId = dto.sessionId;
      event.fingerprintId = dto.fingerprintId;
      event.ipAddress = dto.ipAddress;
      event.userAgent = dto.userAgent;
      event.timestamp = new Date();

      this.batchingService.addEvent(event);

      if (this.featureEventsCounter) {
        this.featureEventsCounter.inc(
          {
            category: dto.category,
            action: dto.action,
            eventType: dto.eventType,
          },
          dto.value ?? 1,
        );
      }

      this.logger.debug(`Event tracked: ${dto.eventType} - ${dto.category}.${dto.action}`);
    } catch (err) {
      this.logger.error(`Failed to track event: ${(err as Error).message}`, err as Error);
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(`Event tracking failed: ${(err as Error).message}`);
    }
  }

  recordEvent(category: string, action: string, _label = '', value = 1): void {
    try {
      if (this.featureEventsCounter) {
        this.featureEventsCounter.inc({ category, action, eventType: EventType.CUSTOM }, value);
      }
    } catch (err) {
      this.logger.error(`Failed to record analytics event: ${category}.${action}`, err as Error);
    }
  }

  recordAssessmentStarted(assessmentId: string): void {
    this.recordEvent('assessment', 'started', assessmentId);
  }

  recordAssessmentSubmitted(assessmentId: string, startedAt: Date): void {
    this.recordEvent('assessment', 'submitted', assessmentId);
    this.observeDuration(startedAt, 'submitted');
  }

  recordAssessmentTimedOut(assessmentId: string, startedAt: Date): void {
    this.recordEvent('assessment', 'timed_out', assessmentId);
    this.observeDuration(startedAt, 'timed_out');
  }

  recordAssessmentScore(score: number, maxScore: number): void {
    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    this.recordEvent('assessment', 'score_recorded', '', pct);
  }

  async getEvents(filters: {
    eventType?: EventType;
    userId?: string;
    category?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ events: AnalyticsEvent[]; total: number }> {
    const query = this.eventRepository.createQueryBuilder('event');

    if (filters.eventType) {
      query.andWhere('event.eventType = :eventType', { eventType: filters.eventType });
    }

    if (filters.userId) {
      query.andWhere('event.userId = :userId', { userId: filters.userId });
    }

    if (filters.category) {
      query.andWhere('event.category = :category', { category: filters.category });
    }

    if (filters.startDate) {
      query.andWhere('event.timestamp >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      query.andWhere('event.timestamp <= :endDate', { endDate: filters.endDate });
    }

    query.orderBy('event.timestamp', 'DESC');
    query.take(filters.limit ?? 100).skip(filters.offset ?? 0);

    const [events, total] = await query.getManyAndCount();
    return { events, total };
  }

  async getAnalyticsSummary(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByCategory: Record<string, number>;
    topActions: Array<{ action: string; count: number }>;
  }> {
    const totalEvents = await this.eventRepository
      .createQueryBuilder('event')
      .where('event.timestamp >= :startDate', { startDate })
      .andWhere('event.timestamp <= :endDate', { endDate })
      .getCount();

    const eventsByType = await this.eventRepository
      .createQueryBuilder('event')
      .select('event.eventType', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('event.timestamp >= :startDate', { startDate })
      .andWhere('event.timestamp <= :endDate', { endDate })
      .groupBy('event.eventType')
      .getRawMany();

    const eventsByCategory = await this.eventRepository
      .createQueryBuilder('event')
      .select('event.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('event.timestamp >= :startDate', { startDate })
      .andWhere('event.timestamp <= :endDate', { endDate })
      .groupBy('event.category')
      .getRawMany();

    const topActions = await this.eventRepository
      .createQueryBuilder('event')
      .select('event.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('event.timestamp >= :startDate', { startDate })
      .andWhere('event.timestamp <= :endDate', { endDate })
      .groupBy('event.action')
      .orderBy('count', 'DESC')
      .take(10)
      .getRawMany();

    return {
      totalEvents,
      eventsByType: Object.fromEntries(eventsByType.map((e) => [e.type, e.count])),
      eventsByCategory: Object.fromEntries(eventsByCategory.map((e) => [e.category, e.count])),
      topActions: topActions.map((e) => ({ action: e.action, count: e.count })),
    };
  }

  private observeDuration(startedAt: Date, status: string): void {
    try {
      const seconds = (Date.now() - startedAt.getTime()) / 1000;
      this.assessmentDuration?.observe({ status }, seconds);
    } catch (err) {
      this.logger.error('Failed to observe assessment duration', err as Error);
    }
  }
}
