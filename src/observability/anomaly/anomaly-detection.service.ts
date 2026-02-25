import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsAnalysisService } from '../metrics/metrics-analysis.service';
import { AnomalyDetectionResult } from '../interfaces/observability.interfaces';

/**
 * Anomaly Detection Service
 * Automatically detects unusual patterns in metrics and logs
 */
@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);
  private anomalies: AnomalyDetectionResult[] = [];
  private readonly MAX_ANOMALIES = 1000;

  // Thresholds for anomaly detection
  private readonly thresholds = {
    errorRate: 5, // 5% error rate
    responseTime: 5000, // 5 seconds
    memoryUsage: 90, // 90% memory usage
    cpuUsage: 85, // 85% CPU usage
    queueBacklog: 1000, // 1000 jobs waiting
    failureRate: 10, // 10% failure rate
  };

  constructor(
    private readonly metricsService: MetricsAnalysisService,
  ) {}

  /**
   * Detect anomalies in a metric using statistical methods
   */
  detectAnomalies(metricName: string, windowSize: number = 100): AnomalyDetectionResult[] {
    const metrics = this.metricsService.getMetrics(metricName, windowSize);
    
    if (metrics.length < 10) {
      return []; // Not enough data
    }

    const values = metrics.map((m) => m.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const anomalies: AnomalyDetectionResult[] = [];

    // Z-score method: values beyond 3 standard deviations are anomalies
    const threshold = 3;

    metrics.forEach((metric) => {
      const zScore = Math.abs((metric.value - mean) / stdDev);
      
      if (zScore > threshold) {
        const anomaly: AnomalyDetectionResult = {
          isAnomaly: true,
          score: zScore,
          threshold,
          metric: metricName,
          timestamp: metric.timestamp,
          details: `Value ${metric.value} is ${zScore.toFixed(2)} standard deviations from mean ${mean.toFixed(2)}`,
        };

        anomalies.push(anomaly);
        this.recordAnomaly(anomaly);
      }
    });

    return anomalies;
  }

  /**
   * Detect anomalies using moving average
   */
  detectAnomaliesMovingAverage(
    metricName: string,
    windowSize: number = 20,
    threshold: number = 2,
  ): AnomalyDetectionResult[] {
    const metrics = this.metricsService.getMetrics(metricName, windowSize * 2);
    
    if (metrics.length < windowSize) {
      return [];
    }

    const anomalies: AnomalyDetectionResult[] = [];

    for (let i = windowSize; i < metrics.length; i++) {
      const window = metrics.slice(i - windowSize, i);
      const avg = window.reduce((a, b) => a + b.value, 0) / window.length;
      const current = metrics[i].value;
      const deviation = Math.abs(current - avg) / avg;

      if (deviation > threshold) {
        const anomaly: AnomalyDetectionResult = {
          isAnomaly: true,
          score: deviation,
          threshold,
          metric: metricName,
          timestamp: metrics[i].timestamp,
          details: `Value ${current} deviates ${(deviation * 100).toFixed(2)}% from moving average ${avg.toFixed(2)}`,
        };

        anomalies.push(anomaly);
        this.recordAnomaly(anomaly);
      }
    }

    return anomalies;
  }

  /**
   * Check for error rate anomalies
   */
  checkErrorRateAnomaly(): AnomalyDetectionResult | null {
    const stats = this.metricsService.getMetricStatistics('api.response_time');
    
    if (!stats) return null;

    // Calculate error rate from response codes
    // This is a simplified version - in production, track actual error counts
    const errorRate = 0; // Placeholder

    if (errorRate > this.thresholds.errorRate) {
      const anomaly: AnomalyDetectionResult = {
        isAnomaly: true,
        score: errorRate,
        threshold: this.thresholds.errorRate,
        metric: 'error_rate',
        timestamp: new Date(),
        details: `Error rate ${errorRate.toFixed(2)}% exceeds threshold ${this.thresholds.errorRate}%`,
      };

      this.recordAnomaly(anomaly);
      return anomaly;
    }

    return null;
  }

  /**
   * Check for response time anomalies
   */
  checkResponseTimeAnomaly(): AnomalyDetectionResult | null {
    const stats = this.metricsService.getMetricStatistics('api.response_time');
    
    if (!stats) return null;

    if (stats.p95 > this.thresholds.responseTime) {
      const anomaly: AnomalyDetectionResult = {
        isAnomaly: true,
        score: stats.p95,
        threshold: this.thresholds.responseTime,
        metric: 'api.response_time',
        timestamp: new Date(),
        details: `P95 response time ${stats.p95.toFixed(2)}ms exceeds threshold ${this.thresholds.responseTime}ms`,
      };

      this.recordAnomaly(anomaly);
      return anomaly;
    }

    return null;
  }

  /**
   * Check for memory usage anomalies
   */
  checkMemoryAnomaly(): AnomalyDetectionResult | null {
    const stats = this.metricsService.getMetricStatistics('system.memory.heap_used');
    
    if (!stats) return null;

    const memoryUsagePercent = (stats.avg / (1024 * 1024 * 1024)) * 100; // Convert to GB and percentage

    if (memoryUsagePercent > this.thresholds.memoryUsage) {
      const anomaly: AnomalyDetectionResult = {
        isAnomaly: true,
        score: memoryUsagePercent,
        threshold: this.thresholds.memoryUsage,
        metric: 'system.memory.heap_used',
        timestamp: new Date(),
        details: `Memory usage ${memoryUsagePercent.toFixed(2)}% exceeds threshold ${this.thresholds.memoryUsage}%`,
      };

      this.recordAnomaly(anomaly);
      return anomaly;
    }

    return null;
  }

  /**
   * Check for sudden spikes in metrics
   */
  detectSuddenSpike(metricName: string, spikeThreshold: number = 3): AnomalyDetectionResult | null {
    const metrics = this.metricsService.getMetrics(metricName, 10);
    
    if (metrics.length < 2) return null;

    const latest = metrics[metrics.length - 1].value;
    const previous = metrics[metrics.length - 2].value;

    if (previous === 0) return null;

    const change = (latest - previous) / previous;

    if (Math.abs(change) > spikeThreshold) {
      const anomaly: AnomalyDetectionResult = {
        isAnomaly: true,
        score: Math.abs(change),
        threshold: spikeThreshold,
        metric: metricName,
        timestamp: new Date(),
        details: `Sudden ${change > 0 ? 'spike' : 'drop'} of ${(Math.abs(change) * 100).toFixed(2)}% detected`,
      };

      this.recordAnomaly(anomaly);
      return anomaly;
    }

    return null;
  }

  /**
   * Record an anomaly
   */
  private recordAnomaly(anomaly: AnomalyDetectionResult): void {
    this.anomalies.push(anomaly);

    // Maintain size limit
    if (this.anomalies.length > this.MAX_ANOMALIES) {
      this.anomalies.shift();
    }

    this.logger.warn(`Anomaly detected: ${anomaly.details}`);

    // In production, send alerts
    this.sendAlert(anomaly);
  }

  /**
   * Get all detected anomalies
   */
  getAnomalies(limit?: number): AnomalyDetectionResult[] {
    return limit ? this.anomalies.slice(-limit) : this.anomalies;
  }

  /**
   * Get anomalies by metric
   */
  getAnomaliesByMetric(metricName: string): AnomalyDetectionResult[] {
    return this.anomalies.filter((a) => a.metric === metricName);
  }

  /**
   * Get recent anomalies
   */
  getRecentAnomalies(minutes: number = 60): AnomalyDetectionResult[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.anomalies.filter((a) => a.timestamp > cutoff);
  }

  /**
   * Clear old anomalies
   */
  clearOldAnomalies(olderThan: Date): number {
    const initialLength = this.anomalies.length;
    this.anomalies = this.anomalies.filter((a) => a.timestamp > olderThan);
    const cleared = initialLength - this.anomalies.length;
    this.logger.log(`Cleared ${cleared} old anomalies`);
    return cleared;
  }

  /**
   * Periodic anomaly detection (runs every 5 minutes)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async periodicAnomalyDetection(): Promise<void> {
    this.logger.debug('Running periodic anomaly detection');

    try {
      // Check various metrics for anomalies
      this.checkErrorRateAnomaly();
      this.checkResponseTimeAnomaly();
      this.checkMemoryAnomaly();

      // Check for spikes in key metrics
      const keyMetrics = [
        'api.response_time',
        'db.query_time',
        'queue.processing_time',
        'user.signups',
        'payment.amount',
      ];

      keyMetrics.forEach((metric) => {
        this.detectSuddenSpike(metric);
      });

      // Statistical anomaly detection
      keyMetrics.forEach((metric) => {
        this.detectAnomalies(metric);
      });

    } catch (error) {
      this.logger.error('Error during periodic anomaly detection:', error);
    }
  }

  /**
   * Send alert for anomaly
   */
  private async sendAlert(anomaly: AnomalyDetectionResult): Promise<void> {
    // In production, integrate with alerting systems:
    // - PagerDuty
    // - Slack
    // - Email
    // - SMS
    // - Custom webhooks

    // For now, just log
    this.logger.warn(`ALERT: ${anomaly.details}`);
  }

  /**
   * Get anomaly statistics
   */
  getAnomalyStatistics() {
    const byMetric: Record<string, number> = {};
    
    this.anomalies.forEach((anomaly) => {
      byMetric[anomaly.metric] = (byMetric[anomaly.metric] || 0) + 1;
    });

    const recentAnomalies = this.getRecentAnomalies(60);

    return {
      total: this.anomalies.length,
      recent: recentAnomalies.length,
      byMetric,
      avgScore: this.anomalies.length > 0
        ? this.anomalies.reduce((sum, a) => sum + a.score, 0) / this.anomalies.length
        : 0,
    };
  }

  /**
   * Check system health based on anomalies
   */
  getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
  } {
    const recentAnomalies = this.getRecentAnomalies(15); // Last 15 minutes

    if (recentAnomalies.length === 0) {
      return { status: 'healthy', issues: [] };
    }

    const issues = recentAnomalies.map((a) => a.details);

    if (recentAnomalies.length > 10) {
      return { status: 'critical', issues };
    }

    if (recentAnomalies.length > 5) {
      return { status: 'warning', issues };
    }

    return { status: 'healthy', issues };
  }
}
