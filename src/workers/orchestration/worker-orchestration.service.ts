import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Job } from 'bull';
import { BaseWorker } from '../base/base.worker';
import { IWorkerPoolConfig, IWorkerHealthCheck, IWorkerMetrics } from '../interfaces/worker.interfaces';
import {
  EmailWorker,
  MediaProcessingWorker,
  DataSyncWorker,
  BackupProcessingWorker,
  WebhooksWorker,
  SubscriptionsWorker,
} from '../processors';

/**
 * Worker Orchestration Service
 * Manages worker pool, routing, and lifecycle
 */
@Injectable()
export class WorkerOrchestrationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerOrchestrationService.name);
  private workerPool: Map<string, BaseWorker[]> = new Map();
  private workerRegistry: Map<string, typeof BaseWorker> = new Map();
  private activeWorkers: Map<string, BaseWorker> = new Map();
  private workerConfigs: Map<string, IWorkerPoolConfig> = new Map();
  private isRunning: boolean = false;

  constructor() {
    this.initializeWorkerRegistry();
    this.initializeDefaultConfigs();
  }

  /**
   * Initialize worker registry with all available workers
   */
  private initializeWorkerRegistry(): void {
    this.workerRegistry.set('email', EmailWorker as any);
    this.workerRegistry.set('media-processing', MediaProcessingWorker as any);
    this.workerRegistry.set('data-sync', DataSyncWorker as any);
    this.workerRegistry.set('backup-processing', BackupProcessingWorker as any);
    this.workerRegistry.set('webhooks', WebhooksWorker as any);
    this.workerRegistry.set('subscriptions', SubscriptionsWorker as any);

    this.logger.log('Worker registry initialized with 6 worker types');
  }

  /**
   * Initialize default worker pool configurations
   */
  private initializeDefaultConfigs(): void {
    const defaultConfigs: Record<string, IWorkerPoolConfig> = {
      email: {
        name: 'email',
        concurrency: 5,
        workerCount: 2,
        maxRetries: 3,
        timeout: 30000,
        healthCheckInterval: 30000,
      },
      'media-processing': {
        name: 'media-processing',
        concurrency: 3,
        workerCount: 1,
        maxRetries: 2,
        timeout: 120000,
        healthCheckInterval: 60000,
      },
      'data-sync': {
        name: 'data-sync',
        concurrency: 4,
        workerCount: 2,
        maxRetries: 3,
        timeout: 60000,
        healthCheckInterval: 45000,
      },
      'backup-processing': {
        name: 'backup-processing',
        concurrency: 1,
        workerCount: 1,
        maxRetries: 2,
        timeout: 300000,
        healthCheckInterval: 120000,
      },
      webhooks: {
        name: 'webhooks',
        concurrency: 10,
        workerCount: 3,
        maxRetries: 5,
        timeout: 15000,
        healthCheckInterval: 30000,
      },
      subscriptions: {
        name: 'subscriptions',
        concurrency: 5,
        workerCount: 2,
        maxRetries: 3,
        timeout: 45000,
        healthCheckInterval: 30000,
      },
    };

    for (const [name, config] of Object.entries(defaultConfigs)) {
      this.workerConfigs.set(name, config);
    }

    this.logger.log('Default worker configurations initialized');
  }

  /**
   * Module initialization
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Worker Orchestration Service');
    await this.startWorkerPool();
  }

  /**
   * Start worker pool
   */
  async startWorkerPool(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Worker pool is already running');
      return;
    }

    try {
      for (const [workerType, config] of this.workerConfigs) {
        await this.initializeWorkerPool(workerType, config);
      }

      this.isRunning = true;
      this.logger.log(`Worker pool started with ${this.activeWorkers.size} workers`);
      this.startHealthCheckInterval();
    } catch (error) {
      this.logger.error('Failed to start worker pool:', error);
      throw error;
    }
  }

  /**
   * Initialize worker pool for a specific worker type
   */
  private async initializeWorkerPool(
    workerType: string,
    config: IWorkerPoolConfig,
  ): Promise<void> {
    const workerClass = this.workerRegistry.get(workerType);
    if (!workerClass) {
      throw new Error(`Unknown worker type: ${workerType}`);
    }

    const workers: BaseWorker[] = [];
    for (let i = 0; i < config.workerCount; i++) {
      const worker = new workerClass();
      workers.push(worker);
      this.activeWorkers.set(worker.getId(), worker);
    }

    this.workerPool.set(workerType, workers);
    this.logger.log(
      `Initialized ${config.workerCount} workers for ${workerType} (concurrency: ${config.concurrency})`,
    );
  }

  /**
   * Route job to appropriate worker
   */
  async routeJob(job: Job): Promise<any> {
    const workerType = this.getWorkerTypeForJob(job);
    const workers = this.workerPool.get(workerType);

    if (!workers || workers.length === 0) {
      throw new Error(`No workers available for job type: ${job.name}`);
    }

    // Round-robin worker selection
    const worker = workers[Math.floor(Math.random() * workers.length)];

    this.logger.log(`Routing job ${job.name} to worker ${worker.getId()}`);
    return worker.handle(job);
  }

  /**
   * Determine worker type based on job name
   */
  private getWorkerTypeForJob(job: Job): string {
    const jobName = job.name.toLowerCase();

    if (jobName.includes('email') || jobName === 'send-email') {
      return 'email';
    }
    if (jobName.includes('media') || jobName.includes('image') || jobName.includes('video')) {
      return 'media-processing';
    }
    if (jobName.includes('sync') || jobName.includes('consistency')) {
      return 'data-sync';
    }
    if (jobName.includes('backup') || jobName.includes('restore')) {
      return 'backup-processing';
    }
    if (jobName.includes('webhook')) {
      return 'webhooks';
    }
    if (jobName.includes('subscription') || jobName.includes('billing')) {
      return 'subscriptions';
    }

    // Default to email if unknown
    return 'email';
  }

  /**
   * Get all active workers
   */
  getActiveWorkers(): BaseWorker[] {
    return Array.from(this.activeWorkers.values());
  }

  /**
   * Get workers by type
   */
  getWorkersByType(workerType: string): BaseWorker[] {
    return this.workerPool.get(workerType) || [];
  }

  /**
   * Get worker by ID
   */
  getWorkerById(workerId: string): BaseWorker | null {
    return this.activeWorkers.get(workerId) || null;
  }

  /**
   * Get all worker metrics
   */
  getAllWorkerMetrics(): IWorkerMetrics[] {
    return this.getActiveWorkers().map((worker) => worker.getMetrics());
  }

  /**
   * Get worker pool statistics
   */
  getPoolStatistics(): any {
    const allMetrics = this.getAllWorkerMetrics();
    const totalJobsProcessed = allMetrics.reduce((sum, m) => sum + m.jobsProcessed, 0);
    const totalJobsFailed = allMetrics.reduce((sum, m) => sum + m.jobsFailed, 0);
    const totalJobsSucceeded = allMetrics.reduce((sum, m) => sum + m.jobsSucceeded, 0);
    const avgExecutionTime =
      totalJobsProcessed > 0
        ? allMetrics.reduce((sum, m) => sum + m.averageExecutionTime, 0) / allMetrics.length
        : 0;

    return {
      totalWorkers: this.activeWorkers.size,
      totalJobsProcessed,
      totalJobsFailed,
      totalJobsSucceeded,
      averageExecutionTime: avgExecutionTime,
      successRate: totalJobsProcessed > 0 ? (totalJobsSucceeded / totalJobsProcessed) * 100 : 0,
      isRunning: this.isRunning,
    };
  }

  /**
   * Start health check interval
   */
  private startHealthCheckInterval(): void {
    setInterval(async () => {
      await this.performHealthCheck();
    }, 60000); // Run health checks every minute
  }

  /**
   * Perform health check on all workers
   */
  private async performHealthCheck(): Promise<void> {
    const healthChecks: IWorkerHealthCheck[] = [];

    for (const worker of this.getActiveWorkers()) {
      const health = await worker.healthCheck();
      healthChecks.push(health);

      if (health.status !== 'healthy') {
        this.logger.warn(`Worker ${worker.getId()} health status: ${health.status}`, health);
      }
    }

    this.logger.debug(`Health check completed. Workers: ${healthChecks.length}`);
  }

  /**
   * Get health check for specific worker
   */
  async getWorkerHealth(workerId: string): Promise<IWorkerHealthCheck | null> {
    const worker = this.getWorkerById(workerId);
    if (!worker) return null;

    return worker.healthCheck();
  }

  /**
   * Get health check for all workers
   */
  async getAllWorkersHealth(): Promise<IWorkerHealthCheck[]> {
    const healthChecks: IWorkerHealthCheck[] = [];

    for (const worker of this.getActiveWorkers()) {
      const health = await worker.healthCheck();
      healthChecks.push(health);
    }

    return healthChecks;
  }

  /**
   * Scale worker pool
   */
  async scaleWorkerPool(workerType: string, newWorkerCount: number): Promise<void> {
    const workers = this.workerPool.get(workerType);
    if (!workers) {
      throw new Error(`Unknown worker type: ${workerType}`);
    }

    const currentCount = workers.length;

    if (newWorkerCount > currentCount) {
      // Add workers
      const workerClass = this.workerRegistry.get(workerType);
      for (let i = currentCount; i < newWorkerCount; i++) {
        const worker = new workerClass();
        workers.push(worker);
        this.activeWorkers.set(worker.getId(), worker);
      }
      this.logger.log(`Scaled up ${workerType} workers from ${currentCount} to ${newWorkerCount}`);
    } else if (newWorkerCount < currentCount) {
      // Remove workers
      const workersToRemove = workers.splice(newWorkerCount, currentCount - newWorkerCount);
      for (const worker of workersToRemove) {
        this.activeWorkers.delete(worker.getId());
      }
      this.logger.log(`Scaled down ${workerType} workers from ${currentCount} to ${newWorkerCount}`);
    }
  }

  /**
   * Module destroy - cleanup
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Worker Orchestration Service');
    await this.stopWorkerPool();
  }

  /**
   * Stop worker pool
   */
  async stopWorkerPool(): Promise<void> {
    this.isRunning = false;
    this.workerPool.clear();
    this.activeWorkers.clear();
    this.logger.log('Worker pool stopped');
  }
}
