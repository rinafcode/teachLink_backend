import { Injectable, Logger } from '@nestjs/common';
import { StructuredLoggerService } from './logging/structured-logger.service';
import { LogAggregationService } from './logging/log-aggregation.service';
import { DistributedTracingService } from './tracing/distributed-tracing.service';
import { MetricsAnalysisService } from './metrics/metrics-analysis.service';
import { AnomalyDetectionService } from './anomaly/anomaly-detection.service';

/**
 * Observability Service
 * Central service for all observability features
 */
@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(
    private readonly structuredLogger: StructuredLoggerService,
    private readonly logAggregation: LogAggregationService,
    private readonly tracing: DistributedTracingService,
    private readonly metrics: MetricsAnalysisService,
    private readonly anomalyDetection: AnomalyDetectionService,
  ) {}

  /**
   * Get comprehensive observability dashboard
   */
  async getObservabilityDashboard() {
    const [
      logStats,
      traceStats,
      metricsStats,
      anomalyStats,
      systemHealth,
    ] = await Promise.all([
      this.logAggregation.getLogStatistics(),
      this.tracing.getTraceStatistics(),
      this.metrics.getAllMetricsStatistics(),
      this.anomalyDetection.getAnomalyStatistics(),
      this.anomalyDetection.getSystemHealth(),
    ]);

    return {
      logs: logStats,
      traces: traceStats,
      metrics: metricsStats,
      anomalies: anomalyStats,
      health: systemHealth,
      timestamp: new Date(),
    };
  }

  /**
   * Get logger instance
   */
  getLogger(): StructuredLoggerService {
    return this.structuredLogger;
  }

  /**
   * Get log aggregation service
   */
  getLogAggregation(): LogAggregationService {
    return this.logAggregation;
  }

  /**
   * Get tracing service
   */
  getTracing(): DistributedTracingService {
    return this.tracing;
  }

  /**
   * Get metrics service
   */
  getMetrics(): MetricsAnalysisService {
    return this.metrics;
  }

  /**
   * Get anomaly detection service
   */
  getAnomalyDetection(): AnomalyDetectionService {
    return this.anomalyDetection;
  }

  /**
   * Initialize observability for a request
   */
  initializeRequestObservability(correlationId: string, userId?: string) {
    this.structuredLogger.setCorrelationId(correlationId);
    if (userId) {
      this.structuredLogger.setUserId(userId);
    }
  }

  /**
   * Track request with full observability
   */
  async trackRequest<T>(
    method: string,
    url: string,
    fn: () => Promise<T>,
    correlationId: string,
  ): Promise<T> {
    const startTime = new Date();
    
    // Initialize logging context
    this.initializeRequestObservability(correlationId);

    // Start trace span
    return this.tracing.executeInSpan(
      `${method} ${url}`,
      async (span) => {
        try {
          // Execute request
          const result = await fn();

          // Calculate duration
          const duration = Date.now() - startTime.getTime();

          // Log request
          this.structuredLogger.logRequest(method, url, 200, duration);

          // Track metrics
          this.metrics.trackApiResponseTime(url, duration, 200);

          return result;
        } catch (error) {
          // Calculate duration
          const duration = Date.now() - startTime.getTime();

          // Log error
          this.structuredLogger.error(
            `Request failed: ${method} ${url}`,
            error as Error,
          );

          // Track metrics
          this.metrics.trackApiResponseTime(url, duration, 500);

          throw error;
        }
      },
      {
        'http.method': method,
        'http.url': url,
        'correlation.id': correlationId,
      },
    );
  }

  /**
   * Get system overview
   */
  async getSystemOverview() {
    const dashboard = await this.getObservabilityDashboard();
    const recentErrors = await this.logAggregation.getErrorLogs(10);
    const recentAnomalies = this.anomalyDetection.getRecentAnomalies(60);

    return {
      status: dashboard.health.status,
      issues: dashboard.health.issues,
      recentErrors: recentErrors.length,
      recentAnomalies: recentAnomalies.length,
      metrics: {
        totalLogs: dashboard.logs.total,
        totalTraces: dashboard.traces.total,
        errorRate: dashboard.logs.errorRate,
        avgResponseTime: dashboard.traces.avgDuration,
      },
      timestamp: new Date(),
    };
  }
}
