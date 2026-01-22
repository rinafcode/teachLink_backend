import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TracingService } from '../tracing/tracing.service';

export interface EventData {
  type: string;
  payload: any;
  source: string;
  timestamp: Date;
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly tracingService: TracingService,
  ) {}

  async publish(eventType: string, payload: any, source: string = 'unknown'): Promise<void> {
    const span = this.tracingService.startSpan(`publish-event-${eventType}`);
    try {
      const eventData: EventData = {
        type: eventType,
        payload,
        source,
        timestamp: new Date(),
      };

      this.eventEmitter.emit(eventType, eventData);
      this.logger.log(`Event published: ${eventType} from ${source}`);
    } catch (error) {
      this.logger.error(`Failed to publish event ${eventType}`, error);
      throw error;
    } finally {
      this.tracingService.endSpan(span);
    }
  }

  async subscribe(eventType: string, handler: (event: EventData) => void): Promise<void> {
    this.eventEmitter.on(eventType, handler);
    this.logger.log(`Subscribed to event: ${eventType}`);
  }

  async subscribeOnce(eventType: string, handler: (event: EventData) => void): Promise<void> {
    this.eventEmitter.once(eventType, handler);
    this.logger.log(`Subscribed once to event: ${eventType}`);
  }

  async unsubscribe(eventType: string, handler: (event: EventData) => void): Promise<void> {
    this.eventEmitter.off(eventType, handler);
    this.logger.log(`Unsubscribed from event: ${eventType}`);
  }

  async getListeners(eventType: string): Promise<any[]> {
    return this.eventEmitter.listeners(eventType);
  }

  async emitAsync(eventType: string, payload: any, source: string = 'unknown'): Promise<void> {
    const span = this.tracingService.startSpan(`emit-async-event-${eventType}`);
    try {
      const eventData: EventData = {
        type: eventType,
        payload,
        source,
        timestamp: new Date(),
      };

      await this.eventEmitter.emitAsync(eventType, eventData);
      this.logger.log(`Async event emitted: ${eventType} from ${source}`);
    } catch (error) {
      this.logger.error(`Failed to emit async event ${eventType}`, error);
      throw error;
    } finally {
      this.tracingService.endSpan(span);
    }
  }
}
