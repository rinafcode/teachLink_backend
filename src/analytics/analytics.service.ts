import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent, EventType } from './entities/event.entity';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
import { EventBatchingService, ITrackEventDto } from './services/event-batching.service';
import { EventValidationService } from './services/event-validation.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private featureEventsCounter: any | null = null;

  constructor(
    @InjectRepository(AnalyticsEvent)
    private eventRepository: Repository<AnalyticsEvent>,
    private readonly metrics: MetricsCollectionService,
    private readonly batchingService: EventBatchingService,
    private readonly validationService: EventValidationService,
  ) {
    try {
      const registry = this.metrics.getRegistry();
      // Lazy require prom-client to avoid import cycles
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const prom = require('prom-client');

      // Create a shared counter for feature events with labels
      this.featureEventsCounter =
        registry.getSingleMetric('feature_events_total') ||
        new prom.Counter({
          name: 'feature_events_total',
          help: 'Feature analytics events',
          labelNames: ['category', 'action', 'eventType'],
          registers: [registry],
        });
    } catch (err) {
      this.logger.warn('Could not initialize feature events counter', err as Error);
      this.featureEventsCounter = null;
    }
  }

  /**
   * Track an event with full validation and batching
   */
  async trackEvent(dto: ITrackEventDto): Promise<void> {
    try {
      // Validate event
      this.validationService.validateEventOrThrow(dto);

      // Create event entity
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

      // Add to batch for processing
      this.batchingService.addEvent(event);

      // Record Prometheus metrics
      if (this.featureEventsCounter) {
        this.featureEventsCounter.inc({
          category: dto.category,
          action: dto.action,
          eventType: dto.eventType,
        });
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

  /**
   * Legacy method for backward compatibility with Prometheus metrics only
   */
  recordEvent(category: string, action: string, label?: string, value?: number): void {
    try {
      if (this.featureEventsCounter) {
        this.featureEventsCounter.inc(
          { category, action, eventType: EventType.CUSTOM },
          value ?? 1,
        );
      } else {
        this.logger.debug(`Analytics event (log only): ${category}.${action} value=${value}`);
      }
    } catch (err) {
      this.logger.error('Failed to record analytics event', err as Error);
    }
  }

  /**
   * Query events with filters
   */
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

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    query.take(limit).skip(offset);

    const [events, total] = await query.getManyAndCount();

    return { events, total };
  }

  /**
   * Get event analytics summary
   */
  async getAnalyticsSummary(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByCategory: Record<string, number>;
    topActions: Array<{ action: string; count: number }>;
  }> {
    const query = this.eventRepository.createQueryBuilder('event');

    query.where('event.timestamp >= :startDate', { startDate });
    query.andWhere('event.timestamp <= :endDate', { endDate });

    const totalEvents = await query.getCount();

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
}
