import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsCollectionService } from './metrics/metrics-collection.service';
import { WorkerOrchestrationService } from '../workers/orchestration/worker-orchestration.service';
import { AlertingService } from './alerting/alerting.service';

type Sample = {
  timestamp: number;
  totalJobsProcessed: number;
  averageExecutionTimeMs: number;
  totalWorkers: number;
};

/**
 * Capacity Planning Service
 * - Collects lightweight time-series from existing metrics
 * - Runs a simple linear regression forecast
 * - Fires alerts before capacity exhaustion and suggests scaling
 */
@Injectable()
export class CapacityPlanningService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CapacityPlanningService.name);
  private readonly samples: Sample[] = [];
  private readonly maxSamples = 120; // keep up to last 120 minutes

  private running = false;

  constructor(
    private readonly metrics: MetricsCollectionService,
    private readonly workerOrchestration: WorkerOrchestrationService,
    private readonly alerting: AlertingService,
  ) {}

  onModuleInit(): void {
    this.running = true;
    this.logger.log('CapacityPlanningService initialized');
  }

  onModuleDestroy(): void {
    this.running = false;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sampleAndAnalyze(): Promise<void> {
    try {
      // Gather lightweight stats from worker orchestration
      const pool = this.workerOrchestration.getPoolStatistics();
      const totalWorkers = pool.totalWorkers ?? 1;
      const totalJobsProcessed = pool.totalJobsProcessed ?? 0;
      const averageExecutionTime = pool.averageExecutionTime ?? 0; // ms

      const sample: Sample = {
        timestamp: Date.now(),
        totalJobsProcessed,
        averageExecutionTimeMs: averageExecutionTime,
        totalWorkers,
      };

      this.pushSample(sample);
      const forecast = this.forecastUtilizationMinutes(60);

      // If any forecast point exceeds threshold, alert and recommend scaling
      const threshold = 0.9; // 90% utilization
      const exceed = forecast.find((f) => f.utilization >= threshold);
      if (exceed) {
        const minutesAhead = exceed.minutesAhead;
        const predictedUtil = exceed.utilization;
        const recommendedWorkers = this.recommendWorkers(predictedUtil, totalWorkers);

        const message = `Projected utilization ${Math.round(predictedUtil * 100)}% in ${minutesAhead}m — recommend scaling from ${totalWorkers} → ${recommendedWorkers}`;
        this.alerting.sendAlert('CAPACITY_PLANNING_WARNING', message, 'WARNING', {
          predictedUtil: Math.round(predictedUtil * 100),
          minutesAhead,
          currentWorkers: totalWorkers,
          recommendedWorkers,
        });
      }
    } catch (err) {
      this.logger.error('Capacity planning failed: ' + (err as Error).message);
    }
  }

  private pushSample(s: Sample) {
    this.samples.push(s);
    if (this.samples.length > this.maxSamples) this.samples.shift();
  }

  /**
   * Forecast utilization for the next N minutes.
   * Utilization = (jobsPerMinute * avgExecutionTimeMs) / (totalWorkers * 60_000)
   */
  forecastUtilizationMinutes(minutes: number): { minutesAhead: number; utilization: number }[] {
    if (this.samples.length < 3) {
      // Not enough data — return conservative flat forecast
      const latest = this.samples[this.samples.length - 1];
      const util = latest
        ? (latest.totalJobsProcessed * latest.averageExecutionTimeMs) / (latest.totalWorkers * 60_000)
        : 0;
      return Array.from({ length: minutes }, (_, i) => ({ minutesAhead: i + 1, utilization: util }));
    }

    // Build time series for jobs per minute
    const points = this.samples.map((s, i) => ({ x: i, y: s.totalJobsProcessed }));
    const { slope, intercept } = this.linearRegression(points);

    const last = this.samples[this.samples.length - 1];
    const result: { minutesAhead: number; utilization: number }[] = [];
    for (let m = 1; m <= minutes; m++) {
      const predictedJobs = Math.max(0, intercept + slope * (points.length + m - 1));
      const predictedAvgExec = last.averageExecutionTimeMs;
      const predictedWorkers = last.totalWorkers || 1;
      const util = (predictedJobs * predictedAvgExec) / (predictedWorkers * 60_000);
      result.push({ minutesAhead: m, utilization: util });
    }

    return result;
  }

  /**
   * Linear regression (least squares) on integer x,y points
   */
  linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
    const n = points.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumXX += p.x * p.x;
    }
    const slope = (n * sumXY - sumX * sumY) / Math.max(1, n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  }

  recommendWorkers(predictedUtil: number, currentWorkers: number): number {
    // target utilization 60% (0.6)
    const target = 0.6;
    if (predictedUtil <= target) return currentWorkers;
    const needed = Math.ceil((predictedUtil / target) * currentWorkers);
    return Math.max(1, needed);
  }

  /**
   * Produce per-worker-type recommendations and summary.
   * Uses current worker metrics to estimate jobs/minute and utilization.
   */
  getRecommendations(): Array<{
    workerType: string;
    currentWorkers: number;
    jobsPerMinute: number;
    averageExecutionTimeMs: number;
    utilization: number; // 0..1
    recommendedWorkers: number;
    reason?: string;
  }> {
    const metrics = this.workerOrchestration.getAllWorkerMetrics();
    const byType = new Map<string, any[]>();
    for (const m of metrics) {
      const arr = byType.get(m.workerType) || [];
      arr.push(m);
      byType.set(m.workerType, arr);
    }

    const results: any[] = [];
    for (const [workerType, arr] of byType.entries()) {
      const currentWorkers = arr.length;
      // Estimate jobs per minute using jobsProcessed / (uptime minutes)
      let jobsPerMinute = 0;
      let avgExec = 0;
      let totalUptimeMs = 0;
      let totalJobs = 0;
      for (const w of arr) {
        totalJobs += w.jobsProcessed || 0;
        totalUptimeMs += w.uptime || 0;
        avgExec += (w.averageExecutionTime || 0) * 1; // accumulate
      }
      avgExec = currentWorkers > 0 ? avgExec / currentWorkers : 0;
      const uptimeMinutes = totalUptimeMs / 60000 || 1; // avoid div0
      jobsPerMinute = uptimeMinutes > 0 ? totalJobs / uptimeMinutes : 0;

      const utilization = (jobsPerMinute * avgExec) / (Math.max(1, currentWorkers) * 60000);
      const recommendedWorkers = this.recommendWorkers(utilization, currentWorkers);
      const reason = utilization >= 0.9 ? 'projected high utilization' : utilization >= 0.6 ? 'above target' : 'within target';

      results.push({
        workerType,
        currentWorkers,
        jobsPerMinute: Number(jobsPerMinute.toFixed(2)),
        averageExecutionTimeMs: Number(avgExec.toFixed(2)),
        utilization: Number(utilization.toFixed(4)),
        recommendedWorkers,
        reason,
      });
    }

    return results;
  }
}
