import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import type { EventBusService } from '../services/event-bus.service';
import type { DistributedTracingService } from '../services/distributed-tracing.service';
import type { Event } from '../interfaces/messaging.interfaces';

@Processor('event-bus')
export class EventProcessor {
  private readonly logger = new Logger(EventProcessor.name);

  constructor(
    private readonly eventBusService: EventBusService,
    private readonly tracingService: DistributedTracingService,
  ) {}

  @Process('process-event')
  async processEvent(job: Job<Event>) {
    const event = job.data;
    const span = this.tracingService.startSpan('event.process', {
      eventId: event.id,
      eventType: event.type,
      source: event.source,
    });

    try {
      this.logger.log(`Processing event ${event.id} of type ${event.type}`);

      await this.eventBusService.processEvent(event);

      span.setTag('success', true);
      this.logger.log(`Event ${event.id} processed successfully`);
    } catch (error) {
      span.setTag('error', true);
      span.setTag('error.message', error.message);
      this.logger.error(
        `Failed to process event ${event.id}: ${error.message}`,
      );
      throw error;
    } finally {
      span.finish();
    }
  }
}
