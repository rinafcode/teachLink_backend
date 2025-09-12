import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, interval } from 'rxjs';
import { map, buffer, filter } from 'rxjs/operators';
import { StreamEvent } from '../pipelines/data-pipeline.service';

/**
 * Interface for analytics metric
 */
export interface AnalyticsMetric<T = any> {
  name: string;
  value: T;
  timestamp: number;
  dimensions?: Record<string, string>;
}

/**
 * Interface for time window aggregation
 */
export interface TimeWindowAggregation {
  windowStart: number;
  windowEnd: number;
  count: number;
  sum?: number;
  avg?: number;
  min?: number;
  max?: number;
  metrics: Record<string, any>;
}

/**
 * Service for real-time analytics processing
 */
@Injectable()
export class RealTimeAnalyticsService {
  private readonly logger = new Logger(RealTimeAnalyticsService.name);
  private readonly metricSubject = new Subject<AnalyticsMetric>();
  private readonly aggregations = new Map<string, TimeWindowAggregation[]>();

  /**
   * Track a metric for analytics
   * @param metric The metric to track
   */
  trackMetric(metric: AnalyticsMetric): void {
    this.logger.debug(`Tracking metric: ${metric.name} = ${metric.value}`);
    this.metricSubject.next({
      ...metric,
      timestamp: metric.timestamp || Date.now(),
    });
  }

  /**
   * Get an observable of all metrics
   */
  observeMetrics(): Observable<AnalyticsMetric> {
    return this.metricSubject.asObservable();
  }

  /**
   * Get an observable of specific metric types
   * @param metricName The metric name to observe
   */
  observeMetricByName(metricName: string): Observable<AnalyticsMetric> {
    return this.metricSubject.pipe(
      filter(metric => metric.name === metricName)
    );
  }

  /**
   * Create a time window aggregation for events
   * @param source The source event stream
   * @param windowSizeMs The window size in milliseconds
   * @param aggregationFn The aggregation function
   */
  createTimeWindowAggregation<T>(
    source: Observable<StreamEvent<T>>,
    windowSizeMs: number,
    aggregationFn: (events: StreamEvent<T>[]) => Record<string, any>,
  ): Observable<TimeWindowAggregation> {
    const windowStart = Date.now();
    
    return source.pipe(
      buffer(interval(windowSizeMs)),
      filter(events => events.length > 0),
      map(events => {
        const windowEnd = Date.now();
        const metrics = aggregationFn(events);
        
        const aggregation: TimeWindowAggregation = {
          windowStart,
          windowEnd,
          count: events.length,
          metrics,
        };
        
        // Calculate basic statistics if numeric values are present
        const numericValues = events
          .map(e => Number(e.data))
          .filter(n => !isNaN(n));
          
        if (numericValues.length > 0) {
          const sum = numericValues.reduce((a, b) => a + b, 0);
          aggregation.sum = sum;
          aggregation.avg = sum / numericValues.length;
          aggregation.min = Math.min(...numericValues);
          aggregation.max = Math.max(...numericValues);
        }
        
        return aggregation;
      })
    );
  }

  /**
   * Store an aggregation result
   * @param key The aggregation key
   * @param aggregation The aggregation result
   * @param maxHistory Maximum number of historical aggregations to keep
   */
  storeAggregation(
    key: string,
    aggregation: TimeWindowAggregation,
    maxHistory = 100,
  ): void {
    if (!this.aggregations.has(key)) {
      this.aggregations.set(key, []);
    }
    
    const history = this.aggregations.get(key);
    history.push(aggregation);
    
    // Trim history if needed
    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }
  }

  /**
   * Get aggregation history for a key
   * @param key The aggregation key
   */
  getAggregationHistory(key: string): TimeWindowAggregation[] {
    return this.aggregations.get(key) || [];
  }

  /**
   * Calculate event rate per second
   * @param events Array of events
   * @param timeWindowMs Time window in milliseconds
   */
  calculateEventRate(events: StreamEvent[], timeWindowMs: number): number {
    return (events.length / timeWindowMs) * 1000;
  }

  /**
   * Detect anomalies in metrics using simple threshold
   * @param metricName The metric name to analyze
   * @param threshold The threshold value
   * @param comparator The comparison function
   */
  detectAnomalies<T>(
    metricName: string,
    threshold: number,
    comparator: (value: T, threshold: number) => boolean,
  ): Observable<AnalyticsMetric<T>> {
    return this.observeMetricByName(metricName).pipe(
      filter(metric => comparator(metric.value as T, threshold))
    );
  }
}