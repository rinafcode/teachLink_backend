import { Injectable, Logger } from '@nestjs/common';
import { QueueAnalyticsService, QueuePerformanceMetrics } from '../analytics/queue-analytics.service';
import { QueueMonitoringService, QueueMetrics, Alert } from '../monitoring/queue-monitoring.service';
import { QueueService } from '../queue.service';
import { Job } from '../interfaces/job.interface';

/**
 * Interface for dashboard data
 */
export interface DashboardData {
  summary: QueueSummary;
  performance: QueuePerformanceMetrics;
  activeJobs: Job[];
  recentlyCompletedJobs: Job[];
  recentlyFailedJobs: Job[];
  alerts: Alert[];
  metrics: QueueMetrics;
}

/**
 * Interface for queue summary
 */
export interface QueueSummary {
  totalJobs: number;
  waitingJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  delayedJobs: number;
  uptime: number; // in milliseconds
  status: 'healthy' | 'warning' | 'critical';
}

/**
 * Service for queue performance dashboard
 */
@Injectable()
export class QueueDashboardService {
  private readonly logger = new Logger(QueueDashboardService.name);
  private readonly recentJobsLimit = 10;
  
  constructor(
    private readonly queueService: QueueService,
    private readonly queueAnalyticsService: QueueAnalyticsService,
    private readonly queueMonitoringService: QueueMonitoringService,
  ) {}

  /**
   * Get dashboard data for a queue
   * @param queueName The queue name (optional, defaults to 'default')
   */
  async getDashboardData(queueName: string = 'default'): Promise<DashboardData> {
    this.logger.log(`Generating dashboard data for queue: ${queueName}`);
    
    // Get queue metrics
    const metrics = this.queueMonitoringService.getCurrentMetrics();
    
    // Get performance metrics
    const performance = this.queueAnalyticsService.getQueuePerformanceMetrics(queueName);
    
    // Get active jobs
    const activeJobs = await this.queueService.getJobsByStatus('active');
    
    // Get recently completed jobs
    const completedJobs = await this.queueService.getJobsByStatus('completed');
    const recentlyCompletedJobs = completedJobs
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, this.recentJobsLimit);
    
    // Get recently failed jobs
    const failedJobs = await this.queueService.getJobsByStatus('failed');
    const recentlyFailedJobs = failedJobs
      .sort((a, b) => b.failedAt - a.failedAt)
      .slice(0, this.recentJobsLimit);
    
    // Get alerts
    const alerts = this.queueMonitoringService.getCurrentAlerts();
    
    // Get queue health status
    const status = this.queueMonitoringService.getQueueHealthStatus();
    
    // Create summary
    const summary: QueueSummary = {
      totalJobs: metrics.totalCount,
      waitingJobs: metrics.waitingCount,
      activeJobs: metrics.activeCount,
      completedJobs: metrics.completedCount,
      failedJobs: metrics.failedCount,
      delayedJobs: metrics.delayedCount,
      uptime: metrics.uptime,
      status,
    };
    
    return {
      summary,
      performance,
      activeJobs,
      recentlyCompletedJobs,
      recentlyFailedJobs,
      alerts,
      metrics,
    };
  }

  /**
   * Get historical performance data for a queue
   * @param queueName The queue name
   * @param timeRange The time range in milliseconds
   */
  async getHistoricalPerformanceData(queueName: string = 'default', timeRange: number = 3600000): Promise<any> {
    this.logger.log(`Generating historical performance data for queue: ${queueName}`);
    
    // Get metrics history
    const metricsHistory = this.queueMonitoringService.getMetricsHistory();
    
    // Filter by time range
    const now = Date.now();
    const filteredHistory = metricsHistory.filter(metric => 
      (now - metric.timestamp) <= timeRange
    );
    
    // Group metrics by time intervals
    const intervalMs = Math.max(60000, Math.floor(timeRange / 60)); // At most 60 data points
    const groupedMetrics = this.groupMetricsByTimeInterval(filteredHistory, intervalMs);
    
    // Calculate throughput over time
    const throughputData = this.calculateThroughputOverTime(groupedMetrics);
    
    // Calculate error rate over time
    const errorRateData = this.calculateErrorRateOverTime(groupedMetrics);
    
    // Calculate processing time over time
    const processingTimeData = this.calculateProcessingTimeOverTime(groupedMetrics);
    
    // Calculate queue length over time
    const queueLengthData = this.calculateQueueLengthOverTime(groupedMetrics);
    
    return {
      throughput: throughputData,
      errorRate: errorRateData,
      processingTime: processingTimeData,
      queueLength: queueLengthData,
      timeRange,
      intervalMs,
    };
  }

  /**
   * Group metrics by time interval
   * @param metrics The metrics to group
   * @param intervalMs The interval in milliseconds
   */
  private groupMetricsByTimeInterval(metrics: QueueMetrics[], intervalMs: number): Map<number, QueueMetrics[]> {
    const groupedMetrics = new Map<number, QueueMetrics[]>();
    
    metrics.forEach(metric => {
      const intervalStart = Math.floor(metric.timestamp / intervalMs) * intervalMs;
      
      if (!groupedMetrics.has(intervalStart)) {
        groupedMetrics.set(intervalStart, []);
      }
      
      groupedMetrics.get(intervalStart).push(metric);
    });
    
    return groupedMetrics;
  }

  /**
   * Calculate throughput over time
   * @param groupedMetrics The grouped metrics
   */
  private calculateThroughputOverTime(groupedMetrics: Map<number, QueueMetrics[]>): Array<{ timestamp: number, value: number }> {
    const result = [];
    
    groupedMetrics.forEach((metrics, timestamp) => {
      if (metrics.length > 0) {
        const lastMetric = metrics[metrics.length - 1];
        const firstMetric = metrics[0];
        const completedDiff = lastMetric.completedCount - firstMetric.completedCount;
        const timeDiffMinutes = (lastMetric.timestamp - firstMetric.timestamp) / 60000;
        
        const throughput = timeDiffMinutes > 0 ? completedDiff / timeDiffMinutes : 0;
        
        result.push({
          timestamp,
          value: throughput,
        });
      }
    });
    
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Calculate error rate over time
   * @param groupedMetrics The grouped metrics
   */
  private calculateErrorRateOverTime(groupedMetrics: Map<number, QueueMetrics[]>): Array<{ timestamp: number, value: number }> {
    const result = [];
    
    groupedMetrics.forEach((metrics, timestamp) => {
      if (metrics.length > 0) {
        const lastMetric = metrics[metrics.length - 1];
        const firstMetric = metrics[0];
        const failedDiff = lastMetric.failedCount - firstMetric.failedCount;
        const totalDiff = (lastMetric.completedCount + lastMetric.failedCount) - 
                          (firstMetric.completedCount + firstMetric.failedCount);
        
        const errorRate = totalDiff > 0 ? (failedDiff / totalDiff) * 100 : 0;
        
        result.push({
          timestamp,
          value: errorRate,
        });
      }
    });
    
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Calculate processing time over time
   * @param groupedMetrics The grouped metrics
   */
  private calculateProcessingTimeOverTime(groupedMetrics: Map<number, QueueMetrics[]>): Array<{ timestamp: number, value: number }> {
    const result = [];
    
    groupedMetrics.forEach((metrics, timestamp) => {
      if (metrics.length > 0) {
        // Use the average processing time from the last metric in the interval
        const lastMetric = metrics[metrics.length - 1];
        
        result.push({
          timestamp,
          value: lastMetric.avgProcessingTime || 0,
        });
      }
    });
    
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Calculate queue length over time
   * @param groupedMetrics The grouped metrics
   */
  private calculateQueueLengthOverTime(groupedMetrics: Map<number, QueueMetrics[]>): Array<{ timestamp: number, value: number }> {
    const result = [];
    
    groupedMetrics.forEach((metrics, timestamp) => {
      if (metrics.length > 0) {
        // Use the queue length from the last metric in the interval
        const lastMetric = metrics[metrics.length - 1];
        const queueLength = lastMetric.waitingCount + lastMetric.activeCount;
        
        result.push({
          timestamp,
          value: queueLength,
        });
      }
    });
    
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }
}