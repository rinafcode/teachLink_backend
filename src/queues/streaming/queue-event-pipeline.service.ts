import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map, mergeMap } from 'rxjs/operators';
import { QueueStreamingService } from '../integration/queue-streaming.service';
import { EventSourcingService } from '../../streaming/event-sourcing/event-sourcing.service';
import { StreamEvent } from '../../streaming/pipelines/data-pipeline.service';

/**
 * Interface for transformed queue event
 */
export interface QueueEvent<T = any> {
  id: string;
  timestamp: number;
  eventType: string;
  queueName: string;
  jobId?: string;
  jobName?: string;
  data: T;
}

/**
 * Service for queue event streaming pipeline
 */
@Injectable()
export class QueueEventPipelineService {
  private readonly logger = new Logger(QueueEventPipelineService.name);
  private readonly eventSubject = new Subject<QueueEvent>();
  
  constructor(
    private readonly queueStreamingService: QueueStreamingService,
    private readonly eventSourcingService: EventSourcingService,
  ) {
    this.initializeEventPipeline();
  }

  /**
   * Initialize the event pipeline
   */
  private initializeEventPipeline(): void {
    this.logger.log('Initializing queue event pipeline');
    
    // Subscribe to all queue events
    this.queueStreamingService.subscribeToAllQueueEvents()
      .pipe(
        // Transform stream events to queue events
        map(this.transformStreamEvent),
        // Store events in event sourcing system
        mergeMap(async (queueEvent) => {
          await this.storeEventInEventSourcing(queueEvent);
          return queueEvent;
        })
      )
      .subscribe(
        (queueEvent) => {
          // Publish to internal event subject
          this.eventSubject.next(queueEvent);
          this.logger.debug(`Processed queue event: ${queueEvent.eventType}`);
        },
        (error) => {
          this.logger.error(`Error in queue event pipeline: ${error.message}`, error.stack);
        }
      );
  }

  /**
   * Transform a stream event to a queue event
   * @param streamEvent The stream event to transform
   */
  private transformStreamEvent(streamEvent: StreamEvent): QueueEvent {
    const queueName = streamEvent.metadata?.queueName || 'default';
    
    return {
      id: streamEvent.id,
      timestamp: streamEvent.timestamp,
      eventType: streamEvent.type,
      queueName,
      jobId: streamEvent.data?.jobId,
      jobName: streamEvent.data?.name,
      data: streamEvent.data,
    };
  }

  /**
   * Store an event in the event sourcing system
   * @param queueEvent The queue event to store
   */
  private async storeEventInEventSourcing(queueEvent: QueueEvent): Promise<void> {
    try {
      await this.eventSourcingService.storeEvent({
        aggregateId: queueEvent.queueName,
        aggregateType: 'queue',
        eventType: queueEvent.eventType,
        eventData: queueEvent.data,
        metadata: {
          jobId: queueEvent.jobId,
          jobName: queueEvent.jobName,
        },
        timestamp: queueEvent.timestamp,
      });
    } catch (error) {
      this.logger.error(`Failed to store event in event sourcing: ${error.message}`, error.stack);
    }
  }

  /**
   * Subscribe to all queue events
   */
  subscribeToAllEvents(): Observable<QueueEvent> {
    return this.eventSubject.asObservable();
  }

  /**
   * Subscribe to specific queue event types
   * @param eventType The event type to subscribe to
   */
  subscribeToEventType(eventType: string): Observable<QueueEvent> {
    return this.eventSubject.pipe(
      filter(event => event.eventType === eventType)
    );
  }

  /**
   * Subscribe to events for a specific queue
   * @param queueName The queue name to subscribe to
   */
  subscribeToQueueEvents(queueName: string): Observable<QueueEvent> {
    return this.eventSubject.pipe(
      filter(event => event.queueName === queueName)
    );
  }

  /**
   * Subscribe to events for a specific job
   * @param jobId The job ID to subscribe to
   */
  subscribeToJobEvents(jobId: string): Observable<QueueEvent> {
    return this.eventSubject.pipe(
      filter(event => event.jobId === jobId)
    );
  }

  /**
   * Replay events for a specific queue
   * @param queueName The queue name
   * @param startTime The start time (optional)
   * @param endTime The end time (optional)
   */
  async replayQueueEvents(queueName: string, startTime?: number, endTime?: number): Promise<QueueEvent[]> {
    const events = await this.eventSourcingService.getEvents({
      aggregateId: queueName,
      aggregateType: 'queue',
      startTime,
      endTime,
    });
    
    return events.map(event => ({
      id: event.id,
      timestamp: event.timestamp,
      eventType: event.eventType,
      queueName,
      jobId: event.metadata?.jobId,
      jobName: event.metadata?.jobName,
      data: event.eventData,
    }));
  }
}