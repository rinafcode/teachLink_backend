import { Injectable, Logger } from '@nestjs/common';
import { MetricData, MetricType } from '../interfaces/observability.interfaces';

/**
 * Metrics Analysis Service
 * Collects and analyzes custom metrics for business and performance insights
 */
@Injectable()
export class MetricsAnalysisService {
  private readonly logger = new Logger(MetricsAnalysisService.name);
  private metrics: Map<string, MetricData[]> = new Map();
  private readonly MAX_METRICS_PER_NAME = 1000;

  /**
   * Record a counter metric
   */
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      type: MetricType.COUNTER,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Record a gauge metric
   */
  recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      type: MetricType.GAUGE,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Record a histogram metric
   */
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      type: MetricType.HISTOGRAM,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Record a summary metric
   */
  recordSummary(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      type: MetricType.SUMMARY,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: MetricData): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metricList = this.metrics.get(metric.name)!;
    metricList.push(metric);

    // Maintain size limit (FIFO)
    if (metricList.length > this.MAX_METRICS_PER_NAME) {
      metricList.shift();
    }

    this.logger.debug(`Recorded metric: ${metric.name} = ${metric.value}`);
  }

  /**
   * Get metrics by name
   */
  getMetrics(name: string, limit?: number): MetricData[] {
    const metrics = this.metrics.get(name) || [];
    return limit ? metrics.slice(-limit) : metrics;
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Calculate metric statistics
   */
  getMetricStatistics(name: string, timeRange?: { start: Date; end: Date }) {
    let metrics = this.metrics.get(name) || [];

    if (timeRange) {
      metrics = metrics.filter(
        (m) => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end,
      );
    }

    if (metrics.length === 0) {
      return null;
    }

    const values = metrics.map((m) => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate percentiles
    const sortedValues = [...values].sort((a, b) => a - b);
    const p50 = this.percentile(sortedValues, 50);
    const p95 = this.percentile(sortedValues, 95);
    const p99 = this.percentile(sortedValues, 99);

    // Calculate standard deviation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      name,
      count: metrics.length,
      sum,
      avg,
      min,
      max,
      p50,
      p95,
      p99,
      stdDev,
      type: metrics[0].type,
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sortedValues[lower];
    }

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Get metrics trend
   */
  getMetricTrend(name: string, windowSize: number = 10): 'up' | 'down' | 'stable' {
    const metrics = this.metrics.get(name) || [];
    if (metrics.length < windowSize * 2) {
      return 'stable';
    }

    const recent = metrics.slice(-windowSize);
    const previous = metrics.slice(-windowSize * 2, -windowSize);

    const recentAvg = recent.reduce((a, b) => a + b.value, 0) / recent.length;
    const previousAvg = previous.reduce((a, b) => a + b.value, 0) / previous.length;

    const change = ((recentAvg - previousAvg) / previousAvg) * 100;

    if (change > 10) return 'up';
    if (change < -10) return 'down';
    return 'stable';
  }

  /**
   * Get all metrics statistics
   */
  getAllMetricsStatistics() {
    const stats: Record<string, any> = {};
    
    this.metrics.forEach((_, name) => {
      stats[name] = this.getMetricStatistics(name);
    });

    return stats;
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(olderThan: Date): number {
    let cleared = 0;

    this.metrics.forEach((metricList, name) => {
      const initialLength = metricList.length;
      const filtered = metricList.filter((m) => m.timestamp > olderThan);
      this.metrics.set(name, filtered);
      cleared += initialLength - filtered.length;
    });

    this.logger.log(`Cleared ${cleared} old metrics`);
    return cleared;
  }

  /**
   * Business Metrics - Track user signups
   */
  trackUserSignup(userId: string, source?: string): void {
    this.incrementCounter('user.signups', 1, { source: source || 'direct' });
  }

  /**
   * Business Metrics - Track course enrollment
   */
  trackCourseEnrollment(courseId: string, userId: string): void {
    this.incrementCounter('course.enrollments', 1, { courseId });
  }

  /**
   * Business Metrics - Track payment
   */
  trackPayment(amount: number, currency: string = 'USD'): void {
    this.recordHistogram('payment.amount', amount, { currency });
    this.incrementCounter('payment.count', 1, { currency });
  }

  /**
   * Performance Metrics - Track API response time
   */
  trackApiResponseTime(endpoint: string, duration: number, statusCode: number): void {
    this.recordHistogram('api.response_time', duration, {
      endpoint,
      status: statusCode.toString(),
    });
  }

  /**
   * Performance Metrics - Track database query time
   */
  trackDatabaseQueryTime(query: string, duration: number): void {
    this.recordHistogram('db.query_time', duration, {
      query: query.substring(0, 50), // Truncate for tag
    });
  }

  /**
   * Performance Metrics - Track cache hit/miss
   */
  trackCacheHit(key: string, hit: boolean): void {
    this.incrementCounter('cache.requests', 1, {
      result: hit ? 'hit' : 'miss',
    });
  }

  /**
   * Performance Metrics - Track queue processing time
   */
  trackQueueProcessingTime(jobName: string, duration: number): void {
    this.recordHistogram('queue.processing_time', duration, { jobName });
  }

  /**
   * System Metrics - Track memory usage
   */
  trackMemoryUsage(): void {
    const usage = process.memoryUsage();
    this.recordGauge('system.memory.heap_used', usage.heapUsed);
    this.recordGauge('system.memory.heap_total', usage.heapTotal);
    this.recordGauge('system.memory.rss', usage.rss);
  }

  /**
   * System Metrics - Track CPU usage
   */
  trackCpuUsage(usage: number): void {
    this.recordGauge('system.cpu.usage', usage);
  }

  /**
   * Get dashboard metrics
   */
  getDashboardMetrics() {
    return {
      business: {
        signups: this.getMetricStatistics('user.signups'),
        enrollments: this.getMetricStatistics('course.enrollments'),
        payments: this.getMetricStatistics('payment.amount'),
      },
      performance: {
        apiResponseTime: this.getMetricStatistics('api.response_time'),
        dbQueryTime: this.getMetricStatistics('db.query_time'),
        queueProcessingTime: this.getMetricStatistics('queue.processing_time'),
      },
      system: {
        memoryUsage: this.getMetricStatistics('system.memory.heap_used'),
        cpuUsage: this.getMetricStatistics('system.cpu.usage'),
      },
      cache: {
        requests: this.getMetricStatistics('cache.requests'),
      },
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];

    this.metrics.forEach((metricList, name) => {
      if (metricList.length === 0) return;

      const latestMetric = metricList[metricList.length - 1];
      const sanitizedName = name.replace(/\./g, '_');

      // Add metric type
      lines.push(`# TYPE ${sanitizedName} ${latestMetric.type}`);

      // Add metric value
      const tags = latestMetric.tags
        ? Object.entries(latestMetric.tags)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',')
        : '';

      lines.push(
        `${sanitizedName}${tags ? `{${tags}}` : ''} ${latestMetric.value}`,
      );
    });

    return lines.join('\n');
  }
}
