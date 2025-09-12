import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, timer } from 'rxjs';
import { buffer, map, mergeMap, throttleTime } from 'rxjs/operators';
import { StreamEvent } from '../pipelines/data-pipeline.service';

/**
 * Interface for stream performance metrics
 */
export interface StreamPerformanceMetrics {
  throughput: number; // events per second
  latency: number; // milliseconds
  backpressure: number; // 0-1 scale
  bufferSize: number;
  timestamp: number;
}

/**
 * Interface for optimization strategy
 */
export interface OptimizationStrategy {
  name: string;
  condition: (metrics: StreamPerformanceMetrics) => boolean;
  apply: <T>(source: Observable<StreamEvent<T>>) => Observable<StreamEvent<T>>;
}

/**
 * Service for stream processing optimization
 */
@Injectable()
export class StreamOptimizationService {
  private readonly logger = new Logger(StreamOptimizationService.name);
  private readonly performanceMetrics = new Subject<StreamPerformanceMetrics>();
  private readonly strategies: OptimizationStrategy[] = [];
  private currentMetrics: StreamPerformanceMetrics = {
    throughput: 0,
    latency: 0,
    backpressure: 0,
    bufferSize: 0,
    timestamp: Date.now(),
  };

  constructor() {
    // Register default optimization strategies
    this.registerDefaultStrategies();
  }

  /**
   * Register default optimization strategies
   */
  private registerDefaultStrategies(): void {
    // Throttling strategy for high throughput
    this.registerStrategy({
      name: 'throttling',
      condition: (metrics) => metrics.throughput > 1000,
      apply: <T>(source: Observable<StreamEvent<T>>) =>
        source.pipe(throttleTime(100)),
    });

    // Buffering strategy for high latency
    this.registerStrategy({
      name: 'buffering',
      condition: (metrics) => metrics.latency > 500,
      apply: <T>(source: Observable<StreamEvent<T>>) =>
        source.pipe(
          buffer(timer(0, 200)),
          mergeMap(events => events)
        ),
    });
  }

  /**
   * Register a new optimization strategy
   * @param strategy The strategy to register
   */
  registerStrategy(strategy: OptimizationStrategy): void {
    this.strategies.push(strategy);
    this.logger.log(`Registered optimization strategy: ${strategy.name}`);
  }

  /**
   * Update performance metrics
   * @param metrics The metrics to update
   */
  updateMetrics(metrics: Partial<StreamPerformanceMetrics>): void {
    this.currentMetrics = {
      ...this.currentMetrics,
      ...metrics,
      timestamp: Date.now(),
    };
    
    this.performanceMetrics.next(this.currentMetrics);
    this.logger.debug(`Updated performance metrics: ${JSON.stringify(this.currentMetrics)}`);
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): StreamPerformanceMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Observe performance metrics
   */
  observeMetrics(): Observable<StreamPerformanceMetrics> {
    return this.performanceMetrics.asObservable();
  }

  /**
   * Apply optimization strategies to a stream based on current metrics
   * @param source The source event stream
   */
  optimizeStream<T>(source: Observable<StreamEvent<T>>): Observable<StreamEvent<T>> {
    let optimizedStream = source;
    
    // Apply strategies that match current conditions
    for (const strategy of this.strategies) {
      if (strategy.condition(this.currentMetrics)) {
        this.logger.log(`Applying optimization strategy: ${strategy.name}`);
        optimizedStream = strategy.apply(optimizedStream);
      }
    }
    
    return optimizedStream;
  }

  /**
   * Calculate stream throughput
   * @param eventCount Number of events
   * @param timeWindowMs Time window in milliseconds
   */
  calculateThroughput(eventCount: number, timeWindowMs: number): number {
    return (eventCount / timeWindowMs) * 1000;
  }

  /**
   * Measure event processing latency
   * @param startTime The start time in milliseconds
   */
  measureLatency(startTime: number): number {
    return Date.now() - startTime;
  }

  /**
   * Estimate backpressure based on buffer size and throughput
   * @param bufferSize Current buffer size
   * @param maxBufferSize Maximum buffer size
   */
  estimateBackpressure(bufferSize: number, maxBufferSize: number): number {
    return Math.min(bufferSize / maxBufferSize, 1);
  }

  /**
   * Create a monitoring wrapper for a stream
   * @param source The source event stream
   * @param samplingInterval Sampling interval in milliseconds
   */
  monitorStream<T>(
    source: Observable<StreamEvent<T>>,
    samplingInterval = 1000,
  ): Observable<StreamEvent<T>> {
    let eventCount = 0;
    let startTime = Date.now();
    
    return new Observable<StreamEvent<T>>(observer => {
      // Set up periodic sampling
      const samplingTimer = setInterval(() => {
        const currentTime = Date.now();
        const elapsedMs = currentTime - startTime;
        
        if (elapsedMs > 0) {
          this.updateMetrics({
            throughput: this.calculateThroughput(eventCount, elapsedMs),
            timestamp: currentTime,
          });
        }
        
        // Reset counters
        eventCount = 0;
        startTime = currentTime;
      }, samplingInterval);
      
      // Subscribe to source and count events
      const subscription = source.subscribe({
        next: (event) => {
          const latency = this.measureLatency(event.timestamp);
          eventCount++;
          
          this.updateMetrics({
            latency,
            bufferSize: eventCount,
          });
          
          observer.next(event);
        },
        error: (err) => observer.error(err),
        complete: () => observer.complete(),
      });
      
      // Cleanup on unsubscribe
      return () => {
        clearInterval(samplingTimer);
        subscription.unsubscribe();
      };
    });
  }
}