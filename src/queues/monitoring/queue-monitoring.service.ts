import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueMetrics } from '../interfaces/queue.interfaces';

// ── Exported interfaces

export interface TimestampedMetrics extends QueueMetrics {
  /** Unix timestamp (ms) when this snapshot was taken */
  capturedAt: number;
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

export interface RetryAnalytics {
  windowMinutes: number;
  totalFailed: number;
  totalRetried: number;
  successAfterRetry: number;
  permanentlyFailed: number;
  retryRate: number; // fraction of failed jobs that were retried
  successAfterRetryRate: number;
  byJobType: Record<
    string,
    {
      failed: number;
      retried: number;
      avgAttempts: number;
    }
  >;
}

export interface BulkRetryResult {
  requeued: number;
  skipped: number;
  errors: Array<{ jobId: string | number; reason: string }>;
}

/**
 * Queue Monitoring Service
 *
 * Responsibilities:
 *  1. Periodic metric snapshots with real timestamps (fixes broken throughput)
 *  2. Health checks with configurable thresholds
 *  3. Failed-job inspection with pagination + optional name filtering
 *  4. Stuck-job detection and auto-recovery
 *  5. Retry analytics (per window, per job type)
 *  6. Bulk retry of all failed jobs
 */
@Injectable()
export class QueueMonitoringService {
  private readonly logger = new Logger(QueueMonitoringService.name);

  /** Sliding window of metric snapshots (default: last 100 = ~100 minutes) */
  private readonly metricsHistory: TimestampedMetrics[] = [];
  private readonly MAX_HISTORY_SIZE = 100;

  // Health thresholds — tune per environment
  private readonly THRESHOLDS = {
    failureRateCritical: 0.2, // 20 %
    failureRateWarning: 0.1, // 10 %
    backlogCritical: 5_000,
    backlogWarning: 1_000,
    activeJobsCritical: 500,
    activeJobsWarning: 100,
    delayedJobsWarning: 500,
    stuckThresholdMs: 300_000, // 5 min
  } as const;

  constructor(@InjectQueue('default') private readonly defaultQueue: Queue) {}

  /**
   * Capture and return the current queue metrics.
   * Appends a timestamped snapshot to the in-memory history window.
   */
  async getQueueMetrics(): Promise<TimestampedMetrics> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.defaultQueue.getWaitingCount(),
      this.defaultQueue.getActiveCount(),
      this.defaultQueue.getCompletedCount(),
      this.defaultQueue.getFailedCount(),
      this.defaultQueue.getDelayedCount(),
      this.defaultQueue.getPausedCount(),
    ]);

    const total = waiting + active + completed + failed + delayed + paused;
    const capturedAt = Date.now();

    const throughput = this.calculateThroughput(completed, capturedAt);
    const avgProcessingTime = await this.calculateAvgProcessingTime();

    const metrics: TimestampedMetrics = {
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
      capturedAt,
    };

    this.appendToHistory(metrics);
    return metrics;
  }

  /**
   * Return the in-memory metrics history.
   * Each entry includes a `capturedAt` timestamp so callers can draw charts.
   */
  getMetricsHistory(): TimestampedMetrics[] {
    return [...this.metricsHistory];
  }

  async checkQueueHealth(): Promise<QueueHealthStatus> {
    const metrics = await this.getQueueMetrics();
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    const failureRate = metrics.total > 0 ? metrics.failed / metrics.total : 0;

    if (failureRate > this.THRESHOLDS.failureRateCritical) {
      issues.push(`Critical failure rate: ${(failureRate * 100).toFixed(1)}%`);
      status = 'critical';
    } else if (failureRate > this.THRESHOLDS.failureRateWarning) {
      issues.push(`Elevated failure rate: ${(failureRate * 100).toFixed(1)}%`);
      this.escalate(status, 'warning');
      status = 'warning';
    }

    if (metrics.waiting > this.THRESHOLDS.backlogCritical) {
      issues.push(`Critical backlog: ${metrics.waiting} waiting jobs`);
      status = 'critical';
    } else if (metrics.waiting > this.THRESHOLDS.backlogWarning) {
      issues.push(`Elevated backlog: ${metrics.waiting} waiting jobs`);
      if (status === 'healthy') status = 'warning';
    }

    if (metrics.active > this.THRESHOLDS.activeJobsCritical) {
      issues.push(`Critical active-job count: ${metrics.active}`);
      status = 'critical';
    } else if (metrics.active > this.THRESHOLDS.activeJobsWarning) {
      issues.push(`High active-job count: ${metrics.active}`);
      if (status === 'healthy') status = 'warning';
    }

    if (metrics.delayed > this.THRESHOLDS.delayedJobsWarning) {
      issues.push(`Many delayed jobs: ${metrics.delayed}`);
      if (status === 'healthy') status = 'warning';
    }

    if (metrics.throughput === 0 && metrics.waiting > 0 && metrics.active === 0) {
      issues.push('Queue appears stalled: jobs waiting but none active and throughput is zero');
      if (status === 'healthy') status = 'warning';
    }

    return { status, issues, metrics, timestamp: new Date() };
  }

  async getQueueStatistics(): Promise<QueueStatistics> {
    const metrics = await this.getQueueMetrics();
    const history = this.metricsHistory;

    return {
      current: metrics,
      trends: {
        completed: this.calculateTrend(history.map((m) => m.completed)),
        failed: this.calculateTrend(history.map((m) => m.failed)),
        throughput: this.calculateTrend(history.map((m) => m.throughput)),
      },
      health: await this.checkQueueHealth(),
    };
  }

  // ── Public API: failed jobs

  /**
   * Paginated failed-job list with optional name filter.
   */
  async getFailedJobs(limit: number = 50, offset: number = 0, jobName?: string): Promise<Job[]> {
    if (jobName) {
      const all = await this.defaultQueue.getFailed(0, 5_000);
      const filtered = all.filter((j) => j.name === jobName);
      return filtered.slice(offset, offset + limit);
    }

    return this.defaultQueue.getFailed(offset, offset + limit - 1);
  }

  /**
   * Retry every currently-failed job.
   * Returns a summary so callers know what happened.
   */
  async retryAllFailedJobs(): Promise<BulkRetryResult> {
    const failed = await this.defaultQueue.getFailed(0, 10_000);
    const result: BulkRetryResult = { requeued: 0, skipped: 0, errors: [] };

    for (const job of failed) {
      try {
        await job.retry();
        result.requeued++;
      } catch (err) {
        result.errors.push({
          jobId: job.id,
          reason: (err as Error).message,
        });
        result.skipped++;
      }
    }

    this.logger.log(`Bulk retry complete: ${result.requeued} requeued, ${result.skipped} skipped`);
    return result;
  }

  // ── Public API: stuck jobs

  async getStuckJobs(thresholdMs: number = 300_000): Promise<Job[]> {
    const activeJobs = await this.defaultQueue.getActive();
    const now = Date.now();
    return activeJobs.filter((job) => {
      const startedAt = job.processedOn ?? job.timestamp;
      return now - startedAt > thresholdMs;
    });
  }

  // ── Public API: retry analytics

  /**
   * Analyse retry behaviour for jobs that finished within the given window.
   *
   * Examines the last N completed+failed jobs and produces per-job-type
   * breakdowns so engineers can tune `maxAttempts` per queue type.
   */
  async getRetryAnalytics(windowMinutes: number = 60): Promise<RetryAnalytics> {
    const windowMs = windowMinutes * 60 * 1_000;
    const cutoff = Date.now() - windowMs;

    const [failedJobs, completedJobs] = await Promise.all([
      this.defaultQueue.getFailed(0, 2_000),
      this.defaultQueue.getCompleted(0, 2_000),
    ]);

    // Filter to window
    const recentFailed = failedJobs.filter((j) => (j.finishedOn ?? j.timestamp) >= cutoff);
    const recentCompleted = completedJobs.filter((j) => (j.finishedOn ?? j.timestamp) >= cutoff);

    // Jobs that succeeded after ≥1 retry
    const successAfterRetry = recentCompleted.filter((j) => j.attemptsMade > 1);
    // Jobs that failed after all retries (attemptsMade >= maxAttempts)
    const permanentlyFailed = recentFailed.filter((j) => j.attemptsMade >= (j.opts?.attempts ?? 3));
    const retried = recentFailed.filter((j) => j.attemptsMade > 1);

    // Per-job-type breakdown
    const byJobType: RetryAnalytics['byJobType'] = {};
    const allRecent = [...recentFailed, ...recentCompleted];
    for (const job of allRecent) {
      const bucket = byJobType[job.name] ?? { failed: 0, retried: 0, avgAttempts: 0 };
      const isFailed = recentFailed.includes(job);
      if (isFailed) bucket.failed++;
      if (isFailed && job.attemptsMade > 1) bucket.retried++;
      // Rolling average of attempts
      bucket.avgAttempts =
        (bucket.avgAttempts * (bucket.failed + bucket.retried - 1) + job.attemptsMade) /
        Math.max(bucket.failed + bucket.retried, 1);
      byJobType[job.name] = bucket;
    }

    const totalFailed = recentFailed.length;

    return {
      windowMinutes,
      totalFailed,
      totalRetried: retried.length,
      successAfterRetry: successAfterRetry.length,
      permanentlyFailed: permanentlyFailed.length,
      retryRate: totalFailed > 0 ? retried.length / totalFailed : 0,
      successAfterRetryRate: retried.length > 0 ? successAfterRetry.length / retried.length : 0,
      byJobType,
    };
  }

  // ── Scheduled tasks

  /**
   * Periodic health check — every minute.
   * Logs warnings/criticals and attempts to recover stuck jobs automatically.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async periodicHealthCheck(): Promise<void> {
    try {
      const health = await this.checkQueueHealth();

      if (health.status === 'critical') {
        this.logger.error(`Queue health CRITICAL: ${health.issues.join(' | ')}`);
        await this.sendAlert(health);
      } else if (health.status === 'warning') {
        this.logger.warn(`Queue health WARNING: ${health.issues.join(' | ')}`);
      } else {
        this.logger.debug('Queue health: OK');
      }

      const stuckJobs = await this.getStuckJobs(this.THRESHOLDS.stuckThresholdMs);
      if (stuckJobs.length > 0) {
        this.logger.warn(`Found ${stuckJobs.length} stuck job(s), moving to failed for retry`);
        await this.recoverStuckJobs(stuckJobs);
      }
    } catch (err) {
      this.logger.error('Error during periodic health check:', (err as Error).message);
    }
  }

  // ── Private helpers

  /**
   * Calculate jobs completed per minute using the last two timestamped
   * snapshots.  Falls back to 0 if there is insufficient history.
   */
  private calculateThroughput(currentCompleted: number, capturedAt: number): number {
    if (this.metricsHistory.length === 0) return 0;

    const previous = this.metricsHistory[this.metricsHistory.length - 1];
    const deltaCompleted = Math.max(0, currentCompleted - previous.completed);
    const deltaMs = capturedAt - previous.capturedAt;

    if (deltaMs <= 0) return 0;

    // Jobs per minute
    return Math.round((deltaCompleted / deltaMs) * 60_000);
  }

  private async calculateAvgProcessingTime(): Promise<number> {
    try {
      const completed = await this.defaultQueue.getCompleted(0, 100);
      if (completed.length === 0) return 0;

      const times = completed
        .filter((j) => j.finishedOn != null && j.processedOn != null)
        .map((j) => (j.finishedOn ?? 0) - (j.processedOn ?? 0));

      if (times.length === 0) return 0;
      return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    } catch (err) {
      this.logger.error('Error calculating avg processing time:', (err as Error).message);
      return 0;
    }
  }

  private appendToHistory(metrics: TimestampedMetrics): void {
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.MAX_HISTORY_SIZE) {
      this.metricsHistory.shift();
    }
  }

  private calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';
    const recent = values.slice(-10);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const latest = recent[recent.length - 1];
    if (avg === 0) return 'stable';
    const changePct = ((latest - avg) / avg) * 100;
    if (changePct > 10) return 'up';
    if (changePct < -10) return 'down';
    return 'stable';
  }

  private async recoverStuckJobs(jobs: Job[]): Promise<void> {
    for (const job of jobs) {
      try {
        this.logger.log(`Moving stuck job ${job.id} (${job.name}) to failed for retry`);
        await job.moveToFailed(
          { message: 'Automatically moved: job exceeded stuck threshold' },
          true,
        );
      } catch (err) {
        this.logger.error(`Failed to recover job ${job.id}:`, (err as Error).message);
      }
    }
  }

  private async sendAlert(health: QueueHealthStatus): Promise<void> {
    this.logger.error(
      'QUEUE_ALERT',
      JSON.stringify({
        status: health.status,
        issues: health.issues,
        metrics: health.metrics,
        timestamp: health.timestamp,
      }),
    );
  }

  /** Helper — no-op used for readable escalation logic above */
  private escalate(
    _current: 'healthy' | 'warning' | 'critical',
    _next: 'warning' | 'critical',
  ): void {}
}
