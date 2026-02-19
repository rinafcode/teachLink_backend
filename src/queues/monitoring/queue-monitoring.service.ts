import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueMetrics } from '../interfaces/queue.interfaces';
import { JobStatus } from '../enums/job-priority.enum';

/**
 * Queue Monitoring Service
 * Provides real-time insights and health checks for queues
 */
@Injectable()
export class QueueMonitoringService {
  private readonly logger = new Logger(QueueMonitoringService.name);
  private metricsHistory: Map<string, QueueMetrics[]> = new Map();
  private readonly MAX_HISTORY_SIZE = 100;

  constructor(
    @InjectQueue('default') private readonly defaultQueue: Queue,
  ) {}

  /**
   * Get current queue metrics
   */
  async getQueueMetrics(): Promise<QueueMetrics> {
    const [waiting, active, completed, failed, delayed, paused] =
      await Promise.all([
        this.defaultQueue.getWaitingCount(),
        this.defaultQueue.getActiveCount(),
        this.defaultQueue.getCompletedCount(),
        this.defaultQueue.getFailedCount(),
        this.defaultQueue.getDelayedCount(),
        this.defaultQueue.getPausedCount(),
      ]);

    const total = waiting + active + completed + failed + delayed + paused;

    // Calculate throughput (jobs/minute)
    const throughput = await this.calculateThroughput();

    // Calculate average processing time
    const avgProcessingTime = await this.calculateAvgProcessingTime();

    const metrics: QueueMetrics = {
      queueName: 'default',
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total,
      throughput,
      avgProcessingTime,
    };

    // Store in history
    this.addToHistory('default', metrics);

    return metrics;
  }

  /**
   * Calculate jobs processed per minute
   */
  private async calculateThroughput(): Promise<number> {
    const history = this.metricsHistory.get('default') || [];
    if (history.length < 2) return 0;

    const latest = history[history.length - 1];
    const previous = history[history.length - 2];

    const completedDiff = latest.completed - previous.completed;
    const timeDiff = 60; // Assuming metrics collected every minute

    return Math.round((completedDiff / timeDiff) * 60);
  }

  /**
   * Calculate average job processing time
   */
  private async calculateAvgProcessingTime(): Promise<number> {
    try {
      const completed = await this.defaultQueue.getCompleted(0, 100);
      if (completed.length === 0) return 0;

      const processingTimes = completed
        .filter((job) => job.finishedOn && job.processedOn)
        .map((job) => job.finishedOn! - job.processedOn!);

      if (processingTimes.length === 0) return 0;

      const sum = processingTimes.reduce((a, b) => a + b, 0);
      return Math.round(sum / processingTimes.length);
    } catch (error) {
      this.logger.error('Error calculating avg processing time:', error);
      return 0;
    }
  }

  /**
   * Add metrics to history
   */
  private addToHistory(queueName: string, metrics: QueueMetrics): void {
    if (!this.metricsHistory.has(queueName)) {
      this.metricsHistory.set(queueName, []);
    }

    const history = this.metricsHistory.get(queueName)!;
    history.push(metrics);

    // Keep only last MAX_HISTORY_SIZE entries
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(queueName: string = 'default'): QueueMetrics[] {
    return this.metricsHistory.get(queueName) || [];
  }

  /**
   * Check queue health
   */
  async checkQueueHealth(): Promise<QueueHealthStatus> {
    const metrics = await this.getQueueMetrics();

    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check for high failure rate
    const failureRate = metrics.total > 0 ? metrics.failed / metrics.total : 0;
    if (failureRate > 0.1) {
      issues.push(`High failure rate: ${(failureRate * 100).toFixed(2)}%`);
      status = failureRate > 0.2 ? 'critical' : 'warning';
    }

    // Check for queue backlog
    if (metrics.waiting > 1000) {
      issues.push(`Large backlog: ${metrics.waiting} waiting jobs`);
      status = metrics.waiting > 5000 ? 'critical' : 'warning';
    }

    // Check for stalled jobs
    if (metrics.active > 100) {
      issues.push(`High number of active jobs: ${metrics.active}`);
      if (status === 'healthy') status = 'warning';
    }

    // Check for delayed jobs
    if (metrics.delayed > 500) {
      issues.push(`Many delayed jobs: ${metrics.delayed}`);
      if (status === 'healthy') status = 'warning';
    }

    return {
      status,
      issues,
      metrics,
      timestamp: new Date(),
    };
  }

  /**
   * Get failed jobs for analysis
   */
  async getFailedJobs(limit: number = 50): Promise<Job[]> {
    return this.defaultQueue.getFailed(0, limit);
  }

  /**
   * Get stuck jobs (active for too long)
   */
  async getStuckJobs(thresholdMs: number = 300000): Promise<Job[]> {
    const activeJobs = await this.defaultQueue.getActive();
    const now = Date.now();

    return activeJobs.filter((job) => {
      const processedOn = job.processedOn || job.timestamp;
      return now - processedOn > thresholdMs;
    });
  }

  /**
   * Periodic health check (runs every minute)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async periodicHealthCheck(): Promise<void> {
    try {
      const health = await this.checkQueueHealth();

      if (health.status === 'critical') {
        this.logger.error(
          `Queue health CRITICAL: ${health.issues.join(', ')}`,
        );
        // Send alert to monitoring system
        await this.sendAlert(health);
      } else if (health.status === 'warning') {
        this.logger.warn(
          `Queue health WARNING: ${health.issues.join(', ')}`,
        );
      } else {
        this.logger.debug('Queue health: OK');
      }

      // Check for stuck jobs
      const stuckJobs = await this.getStuckJobs();
      if (stuckJobs.length > 0) {
        this.logger.warn(
          `Found ${stuckJobs.length} stuck jobs, attempting recovery`,
        );
        await this.recoverStuckJobs(stuckJobs);
      }
    } catch (error) {
      this.logger.error('Error during periodic health check:', error);
    }
  }

  /**
   * Send alert to monitoring system
   */
  private async sendAlert(health: QueueHealthStatus): Promise<void> {
    // Implement integration with monitoring/alerting system
    // Examples: PagerDuty, Slack, Email, etc.
    this.logger.error('ALERT:', JSON.stringify(health, null, 2));
  }

  /**
   * Recover stuck jobs
   */
  private async recoverStuckJobs(jobs: Job[]): Promise<void> {
    for (const job of jobs) {
      try {
        this.logger.log(`Recovering stuck job: ${job.id}`);
        await job.moveToFailed(
          { message: 'Job stuck, moved to failed for retry' },
          true,
        );
      } catch (error) {
        this.logger.error(`Failed to recover job ${job.id}:`, error);
      }
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStatistics(): Promise<QueueStatistics> {
    const metrics = await this.getQueueMetrics();
    const history = this.getMetricsHistory();

    // Calculate trends
    const completedTrend = this.calculateTrend(
      history.map((m) => m.completed),
    );
    const failedTrend = this.calculateTrend(history.map((m) => m.failed));

    return {
      current: metrics,
      trends: {
        completed: completedTrend,
        failed: failedTrend,
        throughput: this.calculateTrend(history.map((m) => m.throughput)),
      },
      health: await this.checkQueueHealth(),
    };
  }

  /**
   * Calculate trend (positive, negative, or stable)
   */
  private calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';

    const recent = values.slice(-10);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const latest = recent[recent.length - 1];

    const change = ((latest - avg) / avg) * 100;

    if (change > 10) return 'up';
    if (change < -10) return 'down';
    return 'stable';
  }
}

export interface QueueHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  metrics: QueueMetrics;
  timestamp: Date;
}

export interface QueueStatistics {
  current: QueueMetrics;
  trends: {
    completed: 'up' | 'down' | 'stable';
    failed: 'up' | 'down' | 'stable';
    throughput: 'up' | 'down' | 'stable';
  };
  health: QueueHealthStatus;
}
