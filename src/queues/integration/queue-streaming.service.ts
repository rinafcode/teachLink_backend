import { Injectable, Logger } from '@nestjs/common';
import { DataPipelineService, StreamEvent } from '../../streaming/pipelines/data-pipeline.service';
import { QueueService } from '../queue.service';
import { QueueMonitoringService } from '../monitoring/queue-monitoring.service';
import { Job } from '../interfaces/job.interface';
import { QueueMetrics } from '../monitoring/queue-monitoring.service';
import { Observable } from 'rxjs';

/**
 * Service for integrating the Queue System with the Streaming Module
 */
@Injectable()
export class QueueStreamingService {
  private readonly logger = new Logger(QueueStreamingService.name);
  
  constructor(
    private readonly dataPipelineService: DataPipelineService,
    private readonly queueService: QueueService,
    private readonly queueMonitoringService: QueueMonitoringService,
  ) {
    this.initializeEventStreaming();
  }

  /**
   * Initialize event streaming for queue events
   */
  private initializeEventStreaming(): void {
    this.logger.log('Initializing queue event streaming');
    
    // Subscribe to job completion events
    this.queueService.onCompleted().subscribe(job => {
      this.publishJobEvent('job.completed', job);
    });
    
    // Subscribe to job failure events
    this.queueService.onFailed().subscribe(job => {
      this.publishJobEvent('job.failed', job);
    });
    
    // Subscribe to job progress events
    this.queueService.onProgress().subscribe(({ job, progress }) => {
      this.publishJobEvent('job.progress', job, { progress });
    });
    
    // Periodically publish queue metrics
    setInterval(() => {
      const metrics = this.queueMonitoringService.getCurrentMetrics();
      this.publishMetricsEvent('queue.metrics', metrics);
    }, 5000); // Every 5 seconds
  }

  /**
   * Publish a job event to the data pipeline
   * @param eventType The type of event
   * @param job The job data
   * @param metadata Additional metadata
   */
  publishJobEvent(eventType: string, job: Job, metadata: Record<string, any> = {}): void {
    const event: StreamEvent = {
      id: `queue-${eventType}-${job.id}-${Date.now()}`,
      timestamp: Date.now(),
      type: eventType,
      data: {
        jobId: job.id,
        name: job.name,
        status: job.status,
        priority: job.priority,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        processingTime: job.processingTime,
      },
      metadata: {
        queueName: job.queueName,
        ...metadata,
      },
    };
    
    this.dataPipelineService.publishEvent(event);
    this.logger.debug(`Published ${eventType} event for job ${job.id}`);
  }

  /**
   * Publish queue metrics to the data pipeline
   * @param eventType The type of event
   * @param metrics The queue metrics
   */
  publishMetricsEvent(eventType: string, metrics: QueueMetrics): void {
    const event: StreamEvent = {
      id: `queue-${eventType}-${Date.now()}`,
      timestamp: Date.now(),
      type: eventType,
      data: metrics,
      metadata: {
        source: 'queue-monitoring-service',
      },
    };
    
    this.dataPipelineService.publishEvent(event);
    this.logger.debug(`Published ${eventType} event with metrics`);
  }

  /**
   * Get an observable of queue events by type
   * @param eventType The event type to subscribe to
   */
  subscribeToQueueEvents(eventType: string): Observable<StreamEvent> {
    return this.dataPipelineService.subscribeToEventType(eventType);
  }

  /**
   * Get an observable of all queue events
   */
  subscribeToAllQueueEvents(): Observable<StreamEvent> {
    return this.dataPipelineService.subscribeToAllEvents().pipe(
      // Filter for queue-related events only
      // This assumes all queue events have types starting with 'job.' or 'queue.'
      filter(event => event.type.startsWith('job.') || event.type.startsWith('queue.'))
    );
  }
}