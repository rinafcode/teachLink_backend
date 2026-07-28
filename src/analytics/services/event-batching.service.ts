import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent, EventType } from '../entities/event.entity';

export interface ITrackEventDto {
  eventType: EventType;
  category: string;
  action: string;
  label?: string;
  value?: number;
  properties?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  fingerprintId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Handles event batching and persistence with configurable flush intervals
 */
@Injectable()
export class EventBatchingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBatchingService.name);
  private eventBatch: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = parseInt(process.env.EVENT_BATCH_SIZE || '100', 10);
  private readonly FLUSH_INTERVAL_MS = parseInt(process.env.EVENT_FLUSH_INTERVAL_MS || '5000', 10);
  private isShuttingDown = false;

  constructor(
    @InjectRepository(AnalyticsEvent)
    private eventRepository: Repository<AnalyticsEvent>,
  ) {}

  onModuleInit() {
    this.startBatchFlusher();
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    // Final flush on shutdown
    if (this.eventBatch.length > 0) {
      return this.flushBatch();
    }
  }

  /**
   * Add event to batch, flush if batch size reached
   */
  addEvent(event: AnalyticsEvent): void {
    if (this.isShuttingDown) {
      this.logger.warn('Event received during shutdown, discarding');
      return;
    }

    this.eventBatch.push(event);

    if (this.eventBatch.length >= this.BATCH_SIZE) {
      this.flushBatch().catch((err) => {
        this.logger.error('Failed to flush batch', err as Error);
      });
    }
  }

  /**
   * Flush all batched events to database
   */
  private async flushBatch(): Promise<void> {
    if (this.eventBatch.length === 0) {
      return;
    }

    const eventsToFlush = [...this.eventBatch];
    this.eventBatch = [];

    try {
      await this.eventRepository.insert(eventsToFlush);
      this.logger.debug(`Flushed ${eventsToFlush.length} events to database`);
    } catch (err) {
      this.logger.error(`Failed to flush ${eventsToFlush.length} events`, err as Error);
      // Re-add to batch for retry (up to a limit to prevent memory issues)
      if (this.eventBatch.length < this.BATCH_SIZE * 5) {
        this.eventBatch.unshift(...eventsToFlush);
      }
      throw err;
    }
  }

  /**
   * Start periodic batch flusher
   */
  private startBatchFlusher(): void {
    this.flushInterval = setInterval(() => {
      if (this.eventBatch.length > 0) {
        this.flushBatch().catch((err) => {
          this.logger.error('Periodic flush failed', err as Error);
        });
      }
    }, this.FLUSH_INTERVAL_MS);

    this.logger.log(
      `Event batch flusher started: batch size=${this.BATCH_SIZE}, interval=${this.FLUSH_INTERVAL_MS}ms`,
    );
  }

  /**
   * Get current batch size (for monitoring/testing)
   */
  getBatchSize(): number {
    return this.eventBatch.length;
  }

  /**
   * Force flush (for testing)
   */
  async forceFlush(): Promise<void> {
    await this.flushBatch();
  }
}
