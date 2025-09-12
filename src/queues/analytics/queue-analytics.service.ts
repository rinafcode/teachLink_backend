import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { RealTimeAnalyticsService, AnalyticsMetric, TimeWindowAggregation } from '../../streaming/analytics/real-time-analytics.service';
import { QueueStreamingService } from '../integration/queue-streaming.service';
import { QueueMonitoringService } from '../monitoring/queue-monitoring.service';
import { StreamEvent } from '../../streaming/pipelines/data-pipeline.service';

/**
 * Interface for queue performance metrics
 */
export interface QueuePerformanceMetrics {
  throughput: number; // Jobs per minute
  avgProcessingTime: number; // Average processing time in ms
  errorRate: number; // Percentage of failed jobs
  waitTime: number; // Average wait time in queue
  queueLength: number; // Current queue length
  timestamp: number; // Timestamp of the metrics
}

/**
 * Service for real-time queue analytics
 */
@Injectable()
export class QueueAnalyticsService {
  private readonly logger = new Logger(QueueAnalyticsService.name);
  private readonly metricHistory: Map<string, AnalyticsMetric[]> = new Map();
  private readonly historyLimit = 1000; // Limit history to 1000 entries per metric

  constructor(
    private readonly realTimeAnalyticsService: RealTimeAnalyticsService,
    private readonly queueStreamingService: QueueStreamingService,
    private readonly queueMonitoringService: QueueMonitoringService,
  ) {
    this.initializeAnalytics();
  }

  /**
   * Initialize analytics tracking
   */
  private initializeAnalytics(): void {
    this.logger.log('Initializing queue analytics');
    
    // Track job completion events
    this.queueStreamingService.subscribeToQueueEvents('job.completed')
      .subscribe(event => {
        this.trackJobCompletion(event);
      });
    
    // Track job failure events
    this.queueStreamingService.subscribeToQueueEvents('job.failed')
      .subscribe(event => {
        this.trackJobFailure(event);
      });
    
    // Track queue metrics
    this.queueStreamingService.subscribeToQueueEvents('queue.metrics')
      .subscribe(event => {
        this.trackQueueMetrics(event);
      });
  }

  /**
   * Track job completion metrics
   * @param event The job completion event
   */
  private trackJobCompletion(event: StreamEvent): void {
    const job = event.data;
    
    // Track processing time
    this.realTimeAnalyticsService.trackMetric({
      name: 'queue.processing_time',
      value: job.processingTime,
      timestamp: event.timestamp,
      dimensions: {
        jobName: job.name,
        queueName: event.metadata?.queueName || 'default',
      },
    });
    
    // Track job throughput
    this.realTimeAnalyticsService.trackMetric({
      name: 'queue.throughput',
      value: 1, // Count of completed jobs
      timestamp: event.timestamp,
      dimensions: {
        jobName: job.name,
        queueName: event.metadata?.queueName || 'default',
      },
    });
  }

  /**
   * Track job failure metrics
   * @param event The job failure event
   */
  private trackJobFailure(event: StreamEvent): void {
    const job = event.data;
    
    // Track error rate
    this.realTimeAnalyticsService.trackMetric({
      name: 'queue.error_rate',
      value: 1, // Count of failed jobs
      timestamp: event.timestamp,
      dimensions: {
        jobName: job.name,
        queueName: event.metadata?.queueName || 'default',
        errorType: job.error?.name || 'unknown',
      },
    });
    
    // Track retry attempts
    if (job.attempts > 1) {
      this.realTimeAnalyticsService.trackMetric({
        name: 'queue.retry_attempts',
        value: job.attempts,
        timestamp: event.timestamp,
        dimensions: {
          jobName: job.name,
          queueName: event.metadata?.queueName || 'default',
        },
      });
    }
  }

  /**
   * Track queue metrics
   * @param event The queue metrics event
   */
  private trackQueueMetrics(event: StreamEvent): void {
    const metrics = event.data;
    
    // Track queue length
    this.realTimeAnalyticsService.trackMetric({
      name: 'queue.length',
      value: metrics.waitingCount + metrics.activeCount,
      timestamp: event.timestamp,
      dimensions: {
        queueName: event.metadata?.queueName || 'default',
      },
    });
    
    // Track wait time
    if (metrics.avgWaitTime !== undefined) {
      this.realTimeAnalyticsService.trackMetric({
        name: 'queue.wait_time',
        value: metrics.avgWaitTime,
        timestamp: event.timestamp,
        dimensions: {
          queueName: event.metadata?.queueName || 'default',
        },
      });
    }
  }

  /**
   * Get real-time performance metrics for a queue
   * @param queueName The queue name (optional, defaults to 'default')
   */
  getQueuePerformanceMetrics(queueName: string = 'default'): QueuePerformanceMetrics {
    const currentMetrics = this.queueMonitoringService.getCurrentMetrics();
    
    return {
      throughput: currentMetrics.completedCount / (currentMetrics.uptime / 60000), // Jobs per minute
      avgProcessingTime: currentMetrics.avgProcessingTime || 0,
      errorRate: currentMetrics.totalCount > 0 ? (currentMetrics.failedCount / currentMetrics.totalCount) * 100 : 0,
      waitTime: currentMetrics.avgWaitTime || 0,
      queueLength: currentMetrics.waitingCount + currentMetrics.activeCount,
      timestamp: Date.now(),
    };
  }

  /**
   * Observe a specific queue metric
   * @param metricName The metric name to observe
   */
  observeQueueMetric(metricName: string): Observable<AnalyticsMetric> {
    return this.realTimeAnalyticsService.observeMetricByName(`queue.${metricName}`);
  }

  /**
   * Create a time window aggregation for queue events
   * @param eventType The event type to aggregate
   * @param windowSizeMs The window size in milliseconds
   */
  createQueueEventAggregation(eventType: string, windowSizeMs: number = 60000): Observable<TimeWindowAggregation> {
    const source = this.queueStreamingService.subscribeToQueueEvents(eventType);
    
    return this.realTimeAnalyticsService.createTimeWindowAggregation(
      source,
      windowSizeMs,
      (events) => {
        // Group events by job name
        const jobGroups = events.reduce((acc, event) => {
          const jobName = event.data.name || 'unknown';
          if (!acc[jobName]) acc[jobName] = [];
          acc[jobName].push(event);
          return acc;
        }, {});
        
        // Calculate metrics for each job group
        const jobMetrics = {};
        Object.entries(jobGroups).forEach(([jobName, jobEvents]) => {
          jobMetrics[jobName] = {
            count: jobEvents.length,
            avgProcessingTime: this.calculateAverage(jobEvents, 'processingTime'),
          };
        });
        
        return {
          byJob: jobMetrics,
          totalCount: events.length,
        };
      }
    );
  }

  /**
   * Calculate average value from events
   * @param events The events to process
   * @param field The field to average
   */
  private calculateAverage(events: StreamEvent[], field: string): number {
    const values = events
      .map(e => Number(e.data[field]))
      .filter(n => !isNaN(n));
      
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}