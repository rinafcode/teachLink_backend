import { Injectable, Logger } from '@nestjs/common';
import { WorkerOrchestrationService } from './worker-orchestration.service';
import { IWorkerHealthCheck, IWorkerMetrics } from '../interfaces/worker.interfaces';

/**
 * Worker Health Check Service
 * Monitors and manages worker pool health
 */
@Injectable()
export class WorkerHealthCheckService {
  private readonly logger = new Logger(WorkerHealthCheckService.name);
  private healthCheckInterval: NodeJS.Timeout;

  constructor(private readonly orchestrationService: WorkerOrchestrationService) {}

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
  private generateAlerts(
    healthChecks: IWorkerHealthCheck[],
    metrics: IWorkerMetrics[],
  ): string[] {
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
      alerts.push(
        `WARNING: ${highFailureWorkers.length} worker(s) with high failure rate (>20%)`,
      );
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
        ? metrics.reduce((sum, m) => (m.jobsProcessed > 0 ? m.jobsFailed / m.jobsProcessed : 0), 0) /
          metrics.length
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
