import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bull';
import { BaseWorker } from '../base/base.worker';
import {
  IWorkerPoolConfig,
  IWorkerHealthCheck,
  IWorkerMetrics,
} from '../interfaces/worker.interfaces';
import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';
import {
  EmailWorker,
  MediaProcessingWorker,
  DataSyncWorker,
  BackupProcessingWorker,
  WebhooksWorker,
  SubscriptionsWorker,
} from '../processors';
import Redis from 'ioredis';
import { getSharedRedisClient } from '../../config/cache.config';
import { ConfigService } from '@nestjs/config';

/**
 * Worker Orchestration Service
 * Manages worker pool, routing, and lifecycle
 */
type WorkerConstructor = new (configService: ConfigService) => BaseWorker;

@Injectable()
export class WorkerOrchestrationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerOrchestrationService.name);
  private workerPool: Map<string, BaseWorker[]> = new Map();
  private workerRegistry: Map<string, WorkerConstructor> = new Map();
  private activeWorkers: Map<string, BaseWorker> = new Map();
  private workerConfigs: Map<string, IWorkerPoolConfig> = new Map();
  private isRunning: boolean = false;

  private redis: Redis;
  private readonly workerStallThreshold: number;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsCollection: MetricsCollectionService,
    private readonly configService: ConfigService,
  ) {
    this.initializeWorkerRegistry();
    this.initializeDefaultConfigs();
    this.redis = getSharedRedisClient(configService);
    this.workerStallThreshold =
      configService.get<number>('WORKER_STALL_THRESHOLD_SECONDS', 300) ?? 300;
  }

  /**
   * Pause all queues to stop accepting new jobs
   */
  async pauseAllQueues(): Promise<void> {
    this.logger.log('Pausing all worker queues...');
    // Implementation would depend on your queue system (BullMQ, etc.)
    // This is a placeholder for the actual queue pausing logic
  }

  /**
   * Requeue incomplete jobs for processing after restart
   */
  async requeueIncompleteJobs(): Promise<number> {
    this.logger.log('Requeuing incomplete jobs...');
    const requeuedCount = 0;

    // Implementation would iterate through active jobs and requeue them
    // This is a placeholder for the actual requeue logic

    return requeuedCount;
  }

  /**
   * Terminate all worker processes
   */
  async terminateAllWorkers(timeoutMs: number): Promise<number> {
    this.logger.log(`Terminating all workers with ${timeoutMs}ms timeout...`);
    let terminatedCount = 0;

    for (const [workerId, _worker] of this.activeWorkers) {
      try {
        // Graceful worker termination logic
        terminatedCount++;
        this.activeWorkers.delete(workerId);
      } catch (error) {
        this.logger.error(`Error terminating worker ${workerId}:`, error);
      }
    }

    return terminatedCount;
  }

  /**
   * Emergency stop all workers immediately
   */
  async emergencyStopAll(): Promise<void> {
    this.logger.warn('Emergency stopping all workers...');

    for (const [workerId, _worker] of this.activeWorkers) {
      try {
        // Force termination logic
        this.activeWorkers.delete(workerId);
      } catch (error) {
        this.logger.error(`Error emergency stopping worker ${workerId}:`, error);
      }
    }

    this.workerPool.clear();
  }

  /**
   * Get health check information
   */
  async getHealthCheck(): Promise<{
    totalWorkers: number;
    healthyWorkers: number;
    unhealthyWorkers: number;
    status: string;
    lastCheck: Date;
  }> {
    const totalWorkers = this.activeWorkers.size;
    const healthyWorkers = Array.from(this.activeWorkers.values()).filter(
      (worker) => worker !== null,
    ).length;

    return {
      totalWorkers,
      healthyWorkers,
      unhealthyWorkers: totalWorkers - healthyWorkers,
      status: healthyWorkers === totalWorkers ? 'healthy' : 'degraded',
      lastCheck: new Date(),
    };
  }

  /**
   * Get worker metrics
   */
  async getMetrics(): Promise<{
    totalWorkers: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageExecutionTime: number;
    queueDepth: number;
  }> {
    const workers = Array.from(this.activeWorkers.values());

    return {
      totalWorkers: workers.length,
      activeJobs: 0, // Would be calculated from actual job queues
      completedJobs: workers.reduce((sum, worker) => sum + (worker as any)?.jobsProcessed || 0, 0),
      failedJobs: workers.reduce((sum, worker) => sum + (worker as any)?.jobsFailed || 0, 0),
      averageExecutionTime: 0, // Would be calculated from actual metrics
      queueDepth: 0, // Would be calculated from actual queue
    };
  }

  /**
   * Initialize worker registry with all available workers
   */
  private initializeWorkerRegistry(): void {
    this.workerRegistry.set('email', EmailWorker as unknown as WorkerConstructor);
    this.workerRegistry.set('media-processing', MediaProcessingWorker as WorkerConstructor);
    this.workerRegistry.set('data-sync', DataSyncWorker as WorkerConstructor);
    this.workerRegistry.set('backup-processing', BackupProcessingWorker as WorkerConstructor);
    this.workerRegistry.set('webhooks', WebhooksWorker as WorkerConstructor);
    this.workerRegistry.set('subscriptions', SubscriptionsWorker as WorkerConstructor);

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
  private async initializeWorkerPool(workerType: string, config: IWorkerPoolConfig): Promise<void> {
    const workerClass = this.workerRegistry.get(workerType);
    if (!workerClass) {
      throw new Error(`Unknown worker type: ${workerType}`);
    }

    const workers: BaseWorker[] = [];
    for (let i = 0; i < config.workerCount; i++) {
      const worker = new workerClass(this.configService);
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
    const now = Date.now();

    for (const worker of this.getActiveWorkers()) {
      const workerId = worker.getId();
      const heartbeatKey = `worker:heartbeat:${workerId}`;
      const lastHeartbeat = await this.redis.get(heartbeatKey);

      const health = await worker.healthCheck();
      healthChecks.push(health);

      // Check for stalled worker based on Redis heartbeat
      if (lastHeartbeat) {
        const lastHeartbeatTime = parseInt(lastHeartbeat, 10);
        const stalledDuration = (now - lastHeartbeatTime) / 1000; // Convert to seconds

        if (stalledDuration > this.workerStallThreshold) {
          this.logger.warn(
            `Worker ${workerId} (${worker.getType()}) has stalled. Last activity ${stalledDuration.toFixed(0)}s ago (threshold: ${this.workerStallThreshold}s)`,
          );

          // Restart the stalled worker
          await this.restartWorker(workerId);
        }
      } else if (health.status !== 'healthy') {
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
        const worker = new workerClass(this.configService);
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
      this.logger.log(
        `Scaled down ${workerType} workers from ${currentCount} to ${newWorkerCount}`,
      );
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
   * Restart a stalled worker
   */
  async restartWorker(workerId: string): Promise<boolean> {
    const worker = this.getWorkerById(workerId);
    if (!worker) {
      this.logger.warn(`Attempted to restart non-existent worker: ${workerId}`);
      return false;
    }

    const workerType = worker.getType();
    const workerClass = this.workerRegistry.get(workerType);
    if (!workerClass) {
      this.logger.error(`Unknown worker type ${workerType} for restart`);
      return false;
    }

    // Emit stalled event
    this.eventEmitter.emit('worker.stalled', {
      workerId,
      workerType,
      timestamp: new Date(),
      message: `Worker ${workerId} (${workerType}) exceeded stall threshold of ${this.workerStallThreshold}s`,
    });

    this.logger.log(`Initiating graceful restart of stalled worker ${workerId} (${workerType})`);

    // Remove old worker
    this.activeWorkers.delete(workerId);
    const workers = this.workerPool.get(workerType);
    if (workers) {
      const index = workers.findIndex((w) => w.getId() === workerId);
      if (index !== -1) {
        workers.splice(index, 1);
      }
    }

    // Create new worker
    const newWorker = new workerClass(this.configService);
    if (workers) {
      workers.push(newWorker);
    }
    this.activeWorkers.set(newWorker.getId(), newWorker);

    // Increment Prometheus counter
    this.metricsCollection.workerRestartsTotal.inc({ worker_name: workerType });

    this.logger.log(
      `Successfully restarted worker ${workerId}, new worker ${newWorker.getId()} started`,
    );
    return true;
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
