import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { IWorkerResult, IWorkerMetrics, IWorkerHealthCheck } from '../interfaces/worker.interfaces';

/**
 * Abstract base worker class
 * Provides common functionality for all workers
 */
export abstract class BaseWorker {
  protected readonly logger: Logger;
  protected readonly workerId: string;
  protected jobsProcessed: number = 0;
  protected jobsFailed: number = 0;
  protected jobsSucceeded: number = 0;
  protected totalExecutionTime: number = 0;
  protected lastExecutionTime: number = 0;
  protected createdAt: Date = new Date();
  protected lastActivityAt: Date = new Date();

  constructor(protected readonly workerType: string) {
    this.workerId = `${workerType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.logger = new Logger(`${workerType}Worker`);
  }

  /**
   * Abstract method to be implemented by subclasses
   * Execute the actual job processing logic
   */
  abstract execute(job: Job): Promise<any>;

  /**
   * Main handler for processing jobs
   */
  async handle(job: Job): Promise<IWorkerResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`[${this.workerId}] Processing job ${job.name} (ID: ${job.id})`);

      // Update progress
      await job.progress(10);

      // Execute the job
      const result = await this.execute(job);

      // Update progress
      await job.progress(100);

      const executionTime = Date.now() - startTime;
      this.jobsProcessed++;
      this.jobsSucceeded++;
      this.totalExecutionTime += executionTime;
      this.lastExecutionTime = executionTime;
      this.lastActivityAt = new Date();

      this.logger.log(
        `[${this.workerId}] Job ${job.name} completed successfully in ${executionTime}ms`,
      );

      return {
        success: true,
        data: result,
        executionTime,
        workerId: this.workerId,
        timestamp: new Date(),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.jobsProcessed++;
      this.jobsFailed++;
      this.totalExecutionTime += executionTime;
      this.lastExecutionTime = executionTime;
      this.lastActivityAt = new Date();

      this.logger.error(
        `[${this.workerId}] Job ${job.name} failed after ${executionTime}ms:`,
        error,
      );

      throw error;
    }
  }

  /**
   * Get worker metrics
   */
  getMetrics(): IWorkerMetrics {
    const uptime = Date.now() - this.createdAt.getTime();
    const averageExecutionTime =
      this.jobsProcessed > 0 ? this.totalExecutionTime / this.jobsProcessed : 0;

    // Determine worker status based on metrics
    let status: 'healthy' | 'degraded' | 'unhealthy' | 'idle' = 'healthy';
    const failureRate = this.jobsProcessed > 0 ? this.jobsFailed / this.jobsProcessed : 0;

    if (this.jobsProcessed === 0) {
      status = 'idle';
    } else if (failureRate > 0.1) {
      status = 'degraded';
    } else if (failureRate > 0.3) {
      status = 'unhealthy';
    }

    return {
      workerId: this.workerId,
      workerType: this.workerType,
      jobsProcessed: this.jobsProcessed,
      jobsFailed: this.jobsFailed,
      jobsSucceeded: this.jobsSucceeded,
      averageExecutionTime,
      lastExecutionTime: this.lastExecutionTime,
      uptime,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cpuUsage: (process.cpuUsage().user + process.cpuUsage().system) / 1000, // ms
      status,
      lastUpdate: new Date(),
    };
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<IWorkerHealthCheck> {
    const metrics = this.getMetrics();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'Worker is healthy';

    const failureRate = this.jobsProcessed > 0 ? this.jobsFailed / this.jobsProcessed : 0;

    if (this.jobsProcessed === 0) {
      status = 'healthy';
      message = 'Worker is idle and ready';
    } else if (failureRate > 0.3) {
      status = 'unhealthy';
      message = `High failure rate detected: ${(failureRate * 100).toFixed(2)}%`;
    } else if (failureRate > 0.1) {
      status = 'degraded';
      message = `Moderate failure rate detected: ${(failureRate * 100).toFixed(2)}%`;
    }

    return {
      workerId: this.workerId,
      status,
      message,
      metrics,
      lastCheck: new Date(),
    };
  }

  /**
   * Reset worker metrics
   */
  resetMetrics(): void {
    this.jobsProcessed = 0;
    this.jobsFailed = 0;
    this.jobsSucceeded = 0;
    this.totalExecutionTime = 0;
    this.lastExecutionTime = 0;
    this.logger.log(`[${this.workerId}] Metrics reset`);
  }

  /**
   * Get worker ID
   */
  getId(): string {
    return this.workerId;
  }

  /**
   * Get worker type
   */
  getType(): string {
    return this.workerType;
  }

  /**
   * Get jobs processed count
   */
  getJobsProcessed(): number {
    return this.jobsProcessed;
  }

  /**
   * Get uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.createdAt.getTime();
  }
}
