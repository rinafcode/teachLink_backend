import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WorkerOrchestrationService } from '../orchestration/worker-orchestration.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getSharedRedisClient } from '../../config/cache.config';
import { IWorkerHealthCheck, IWorkerMetrics } from '../interfaces/worker.interfaces';

/**
 * Worker Health Check Service
 * Monitors and manages worker pool health
 */
@Injectable()
export class WorkerHealthCheckService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerHealthCheckService.name);
  private healthCheckInterval: NodeJS.Timeout;
  private stallCheckInterval: NodeJS.Timeout;
  private redis: Redis;
  private readonly workerStallThreshold: number;

  constructor(
    private readonly orchestrationService: WorkerOrchestrationService,
    private readonly configService: ConfigService,
  ) {
    this.redis = getSharedRedisClient(configService);
    this.workerStallThreshold =
      configService.get<number>('WORKER_STALL_THRESHOLD_SECONDS', 300) ?? 300;
  }

  /**
   * On module init - start all checks
   */
  onModuleInit(): void {
    this.startHealthChecks();
    this.startStallDetector();
  }

  /**
   * On module destroy - stop all checks
   */
  onModuleDestroy(): void {
    this.stopHealthChecks();
    this.stopStallDetector();
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      this.logger.warn('Health checks already running');
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performComprehensiveHealthCheck();
    }, intervalMs);

    this.logger.log(`Worker health checks started (interval: ${intervalMs}ms)`);
  }

  /**
   * Start the stalled worker detector (checks every 60s)
   */
  startStallDetector(intervalMs: number = 60000): void {
    if (this.stallCheckInterval) {
      this.logger.warn('Stall detector already running');
      return;
    }

    this.stallCheckInterval = setInterval(async () => {
      await this.checkStalledWorkers();
    }, intervalMs);

    this.logger.log(
      `Worker stall detector started (interval: ${intervalMs}ms, stall threshold: ${this.workerStallThreshold}s)`,
    );
  }

  /**
   * Stop the stalled worker detector
   */
  stopStallDetector(): void {
    if (this.stallCheckInterval) {
      clearInterval(this.stallCheckInterval);
      this.stallCheckInterval = null;
      this.logger.log('Worker stall detector stopped');
    }
  }

  /**
   * Check all workers for stalled heartbeats
   */
  async checkStalledWorkers(): Promise<void> {
    try {
      const activeWorkers = this.orchestrationService.getActiveWorkers();
      const now = Date.now();
      const stallThresholdMs = this.workerStallThreshold * 1000;

      for (const worker of activeWorkers) {
        const workerId = worker.getId();
        const heartbeatKey = `worker:heartbeat:${workerId}`;
        const lastHeartbeatStr = await this.redis.get(heartbeatKey);

        if (!lastHeartbeatStr) {
          // If no heartbeat found, check if worker has been active recently
          const lastActivity = worker.getMetrics().lastUpdate.getTime();
          if (now - lastActivity > stallThresholdMs) {
            this.logger.warn(
              `Worker ${workerId} has no heartbeat and exceeded stall threshold, restarting...`,
            );
            await this.orchestrationService.restartWorker(workerId);
          }
          continue;
        }

        const lastHeartbeat = parseInt(lastHeartbeatStr, 10);
        if (isNaN(lastHeartbeat)) continue;

        if (now - lastHeartbeat > stallThresholdMs) {
          this.logger.warn(
            `Worker ${workerId} heartbeat is stale (last heartbeat: ${new Date(lastHeartbeat).toISOString()}), restarting...`,
          );
          await this.orchestrationService.restartWorker(workerId);
        }
      }
    } catch (error) {
      this.logger.error('Failed to check for stalled workers:', error);
    }
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.log('Worker health checks stopped');
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performComprehensiveHealthCheck(): Promise<any> {
    try {
      const allHealth = await this.orchestrationService.getAllWorkersHealth();
      const metrics = this.orchestrationService.getAllWorkerMetrics();

      const healthSummary = {
        timestamp: new Date(),
        totalWorkers: allHealth.length,
        healthyWorkers: allHealth.filter((h) => h.status === 'healthy').length,
        degradedWorkers: allHealth.filter((h) => h.status === 'degraded').length,
        unhealthyWorkers: allHealth.filter((h) => h.status === 'unhealthy').length,
        poolStats: this.orchestrationService.getPoolStatistics(),
        alerts: this.generateAlerts(allHealth, metrics),
      };

      this.logHealthSummary(healthSummary);
      return healthSummary;
    } catch (error) {
      this.logger.error('Comprehensive health check failed:', error);
      throw error;
    }
  }

  /**
   * Get worker health status
   */
  async getWorkerHealth(workerId: string): Promise<IWorkerHealthCheck | null> {
    try {
      return await this.orchestrationService.getWorkerHealth(workerId);
    } catch (error) {
      this.logger.error(`Failed to get health status for worker ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * Get all workers health status
   */
  async getAllWorkersHealth(): Promise<IWorkerHealthCheck[]> {
    try {
      return await this.orchestrationService.getAllWorkersHealth();
    } catch (error) {
      this.logger.error('Failed to get all workers health status:', error);
      throw error;
    }
  }

  /**
   * Generate alerts based on health data
   */
  private generateAlerts(healthChecks: IWorkerHealthCheck[], metrics: IWorkerMetrics[]): string[] {
    const alerts: string[] = [];

    // Check for unhealthy workers
    const unhealthyWorkers = healthChecks.filter((h) => h.status === 'unhealthy');
    if (unhealthyWorkers.length > 0) {
      alerts.push(
        `CRITICAL: ${unhealthyWorkers.length} worker(s) unhealthy: ${unhealthyWorkers.map((h) => h.workerId).join(', ')}`,
      );
    }

    // Check for high failure rates
    const highFailureWorkers = metrics.filter((m) => {
      const failureRate = m.jobsProcessed > 0 ? m.jobsFailed / m.jobsProcessed : 0;
      return failureRate > 0.2;
    });
    if (highFailureWorkers.length > 0) {
      alerts.push(`WARNING: ${highFailureWorkers.length} worker(s) with high failure rate (>20%)`);
    }

    // Check memory usage
    const highMemoryWorkers = metrics.filter((m) => m.memoryUsage > 500);
    if (highMemoryWorkers.length > 0) {
      alerts.push(`WARNING: ${highMemoryWorkers.length} worker(s) with high memory usage (>500MB)`);
    }

    // Check for idle workers
    const idleWorkers = metrics.filter((m) => m.jobsProcessed === 0);
    if (idleWorkers.length > metrics.length * 0.5) {
      alerts.push(`INFO: ${idleWorkers.length} worker(s) idle`);
    }

    return alerts;
  }

  /**
   * Log health summary
   */
  private logHealthSummary(summary: any): void {
    this.logger.log(`Worker Pool Health Summary:
      Total Workers: ${summary.totalWorkers}
      Healthy: ${summary.healthyWorkers}
      Degraded: ${summary.degradedWorkers}
      Unhealthy: ${summary.unhealthyWorkers}
      Success Rate: ${summary.poolStats.successRate.toFixed(2)}%
      Jobs Processed: ${summary.poolStats.totalJobsProcessed}`);

    if (summary.alerts.length > 0) {
      this.logger.warn('Health Alerts:', summary.alerts);
    }
  }

  /**
   * Check if pool is healthy
   */
  async isPoolHealthy(): Promise<boolean> {
    const health = await this.orchestrationService.getAllWorkersHealth();
    const unhealthyCount = health.filter((h) => h.status === 'unhealthy').length;
    return unhealthyCount === 0;
  }

  /**
   * Get pool health percentage
   */
  async getPoolHealthPercentage(): Promise<number> {
    const health = await this.orchestrationService.getAllWorkersHealth();
    if (health.length === 0) return 100;

    const healthyCount = health.filter((h) => h.status === 'healthy').length;
    return (healthyCount / health.length) * 100;
  }

  /**
   * Detect and report anomalies
   */
  async detectAnomalies(): Promise<any> {
    const metrics = this.orchestrationService.getAllWorkerMetrics();
    const anomalies: any[] = [];

    // Calculate average metrics
    const avgExecutionTime =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.averageExecutionTime, 0) / metrics.length
        : 0;
    const avgFailureRate =
      metrics.length > 0
        ? metrics.reduce(
            (sum, m) => (m.jobsProcessed > 0 ? m.jobsFailed / m.jobsProcessed : 0),
            0,
          ) / metrics.length
        : 0;

    // Check for anomalies
    for (const metric of metrics) {
      // Execution time anomaly
      if (metric.lastExecutionTime > avgExecutionTime * 3) {
        anomalies.push({
          workerId: metric.workerId,
          type: 'slow-execution',
          message: `Execution time (${metric.lastExecutionTime}ms) exceeds average by 3x`,
        });
      }

      // Failure rate anomaly
      const failureRate = metric.jobsProcessed > 0 ? metric.jobsFailed / metric.jobsProcessed : 0;
      if (failureRate > avgFailureRate * 2 && failureRate > 0.05) {
        anomalies.push({
          workerId: metric.workerId,
          type: 'high-failure-rate',
          message: `Failure rate (${(failureRate * 100).toFixed(2)}%) exceeds average by 2x`,
        });
      }
    }

    return anomalies;
  }
}
