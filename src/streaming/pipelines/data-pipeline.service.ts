import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

/**
 * Interface for streaming data events
 */
export interface StreamEvent<T = any> {
  id: string;
  timestamp: number;
  type: string;
  data: T;
  metadata?: Record<string, any>;
}

/**
 * Service for managing data pipelines in streaming applications
 */
@Injectable()
export class DataPipelineService {
  private readonly logger = new Logger(DataPipelineService.name);
  private readonly eventBus = new Subject<StreamEvent>();
  
  /**
   * Publish an event to the data pipeline
   * @param event The event to publish
   */
  publishEvent(event: StreamEvent): void {
    this.logger.debug(`Publishing event: ${event.type} with ID: ${event.id}`);
    this.eventBus.next({
      ...event,
      timestamp: event.timestamp || Date.now(),
    });
  }

  /**
   * Subscribe to all events in the pipeline
   */
  subscribeToAllEvents(): Observable<StreamEvent> {
    return this.eventBus.asObservable();
  }

  /**
   * Subscribe to specific event types
   * @param eventType The event type to subscribe to
   */
  subscribeToEventType(eventType: string): Observable<StreamEvent> {
    return this.eventBus.pipe(
      filter(event => event.type === eventType)
    );
  }

  /**
   * Create a data transformation pipeline
   * @param transformFn The transformation function
   */
  createTransformPipeline<T, R>(
    transformFn: (data: T) => R
  ): (source: Observable<StreamEvent<T>>) => Observable<StreamEvent<R>> {
    return (source: Observable<StreamEvent<T>>) =>
      source.pipe(
        map(event => ({
          ...event,
          data: transformFn(event.data),
        }))
      );
  }

  /**
   * Create a filtered pipeline based on a predicate
   * @param predicateFn The filter predicate function
   */
  createFilterPipeline<T>(
    predicateFn: (data: T) => boolean
  ): (source: Observable<StreamEvent<T>>) => Observable<StreamEvent<T>> {
    return (source: Observable<StreamEvent<T>>) =>
      source.pipe(filter(event => predicateFn(event.data)));
  }

  /**
   * Combine multiple event streams into one
   * @param sources Array of event sources to combine
   */
  mergePipelines(...sources: Observable<StreamEvent>[]): Observable<StreamEvent> {
    const mergedSubject = new Subject<StreamEvent>();
    
    sources.forEach(source => {
      source.subscribe(event => mergedSubject.next(event));
    });
    
    return mergedSubject.asObservable();
  }
}