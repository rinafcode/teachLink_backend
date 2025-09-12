import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bull';
import type { Event } from '../interfaces/messaging.interfaces';
import type { DistributedTracingService } from './distributed-tracing.service';
import * as crypto from 'crypto';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly eventHandlers = new Map<string, Set<Function>>();
  private readonly eventFilters = new Map<string, Function>();
  private readonly eventQueue: Queue;
  private readonly tracingService: DistributedTracingService;

  constructor(eventQueue: Queue, tracingService: DistributedTracingService) {
    this.eventQueue = eventQueue;
    this.tracingService = tracingService;
  }

  async publishEvent(
    event: Omit<Event, 'id' | 'timestamp' | 'metadata'>,
  ): Promise<string> {
    const eventId = crypto.randomUUID();
    const traceContext = this.tracingService.getCurrentContext();

    const fullEvent: Event = {
      ...event,
      id: eventId,
      timestamp: new Date(),
      metadata: {
        traceId: traceContext?.traceId || crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
      },
    };

    // Start trace span
    const span = this.tracingService.startSpan('event.publish', {
      eventId,
      eventType: event.type,
      source: event.source,
    });

    try {
      // Add to event queue for async processing
      await this.eventQueue.add('process-event', fullEvent, {
        priority: this.getEventPriority(event.type),
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      // Process synchronous handlers immediately
      await this.processSyncHandlers(fullEvent);

      this.logger.log(
        `Event ${eventId} of type ${event.type} published successfully`,
      );
      span.setTag('success', true);
      return eventId;
    } catch (error) {
      this.logger.error(`Failed to publish event ${eventId}: ${error.message}`);
      span.setTag('error', true);
      span.setTag('error.message', error.message);
      throw error;
    } finally {
      span.finish();
    }
  }

  async publishBulkEvents(
    events: Array<Omit<Event, 'id' | 'timestamp' | 'metadata'>>,
  ): Promise<string[]> {
    const eventIds: string[] = [];
    const jobs = [];

    for (const event of events) {
      const eventId = crypto.randomUUID();
      const traceContext = this.tracingService.getCurrentContext();

      const fullEvent: Event = {
        ...event,
        id: eventId,
        timestamp: new Date(),
        metadata: {
          traceId: traceContext?.traceId || crypto.randomUUID(),
          correlationId: crypto.randomUUID(),
        },
      };

      eventIds.push(eventId);
      jobs.push({
        name: 'process-event',
        data: fullEvent,
        opts: {
          priority: this.getEventPriority(event.type),
        },
      });
    }

    await this.eventQueue.addBulk(jobs);
    this.logger.log(`${events.length} events published successfully`);

    return eventIds;
  }

  subscribe(
    eventType: string,
    handler: Function,
    options?: { async?: boolean; filter?: Function },
  ): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    this.eventHandlers.get(eventType)!.add(handler);

    if (options?.filter) {
      this.eventFilters.set(`${eventType}:${handler.name}`, options.filter);
    }

    this.logger.log(`Subscribed to event type: ${eventType}`);
  }

  unsubscribe(eventType: string, handler: Function): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
    }

    const filterKey = `${eventType}:${handler.name}`;
    this.eventFilters.delete(filterKey);

    this.logger.log(`Unsubscribed from event type: ${eventType}`);
  }

  async processEvent(event: Event): Promise<void> {
    const span = this.tracingService.startSpan('event.process', {
      eventId: event.id,
      eventType: event.type,
    });

    try {
      const handlers = this.eventHandlers.get(event.type) || new Set();
      const wildcardHandlers = this.eventHandlers.get('*') || new Set();
      const allHandlers = new Set([...handlers, ...wildcardHandlers]);

      if (allHandlers.size === 0) {
        this.logger.warn(`No handlers found for event type: ${event.type}`);
        return;
      }

      const promises = Array.from(allHandlers).map(async (handler) => {
        const filterKey = `${event.type}:${handler.name}`;
        const filter = this.eventFilters.get(filterKey);

        // Apply filter if exists
        if (filter && !filter(event)) {
          return;
        }

        const handlerSpan = this.tracingService.startSpan('event.handler', {
          eventId: event.id,
          handlerName: handler.name,
        });

        try {
          await handler(event);
          handlerSpan.setTag('success', true);
        } catch (error) {
          this.logger.error(
            `Event handler ${handler.name} failed for event ${event.id}: ${error.message}`,
          );
          handlerSpan.setTag('error', true);
          handlerSpan.setTag('error.message', error.message);
          throw error;
        } finally {
          handlerSpan.finish();
        }
      });

      await Promise.allSettled(promises);
      span.setTag('handlersCount', allHandlers.size);
      span.setTag('success', true);
    } catch (error) {
      span.setTag('error', true);
      span.setTag('error.message', error.message);
      throw error;
    } finally {
      span.finish();
    }
  }

  async getEventStats(): Promise<{
    totalHandlers: number;
    handlersByType: Record<string, number>;
    queueStats: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  }> {
    const handlersByType: Record<string, number> = {};
    let totalHandlers = 0;

    for (const [eventType, handlers] of this.eventHandlers) {
      handlersByType[eventType] = handlers.size;
      totalHandlers += handlers.size;
    }

    const [waiting, active, completed, failed] = await Promise.all([
      this.eventQueue.getWaiting(),
      this.eventQueue.getActive(),
      this.eventQueue.getCompleted(),
      this.eventQueue.getFailed(),
    ]);

    return {
      totalHandlers,
      handlersByType,
      queueStats: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      },
    };
  }

  private async processSyncHandlers(event: Event): Promise<void> {
    // Process handlers that are marked as synchronous
    const syncHandlers =
      this.eventHandlers.get(`${event.type}:sync`) || new Set();

    for (const handler of syncHandlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(
          `Sync event handler failed for event ${event.id}: ${error.message}`,
        );
      }
    }
  }

  private getEventPriority(eventType: string): number {
    // Define priority based on event type
    const priorityMap: Record<string, number> = {
      'user.created': 5,
      'user.updated': 3,
      'user.deleted': 5,
      'order.created': 4,
      'order.completed': 4,
      'payment.processed': 5,
      'system.error': 5,
      'system.warning': 3,
      'system.info': 1,
    };

    return priorityMap[eventType] || 2;
  }
}
