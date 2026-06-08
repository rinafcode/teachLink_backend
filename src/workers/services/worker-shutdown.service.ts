import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { WorkerOrchestrationService } from '../orchestration/worker-orchestration.service';

export interface WorkerShutdownOptions {
  gracefulTimeoutMs: number;
  jobCompletionTimeoutMs: number;
  forceTerminationTimeoutMs: number;
  requeueIncompleteJobs: boolean;
  waitForJobCompletion: boolean;
}

export interface WorkerShutdownStatus {
  phase:
    | 'idle'
    | 'stopping_new_jobs'
    | 'waiting_completion'
    | 'requeuing'
    | 'terminating'
    | 'completed';
  activeJobs: number;
  completedJobs: number;
  requeuedJobs: number;
  terminatedWorkers: number;
  totalWorkers: number;
  isShuttingDown: boolean;
}

/**
 * Manages graceful shutdown of worker pools and job queues
 */
@Injectable()
export class WorkerShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerShutdownService.name);
  private isShuttingDown = false;
  private shutdownStatus: WorkerShutdownStatus = {
    phase: 'idle',
    activeJobs: 0,
    completedJobs: 0,
    requeuedJobs: 0,
    terminatedWorkers: 0,
    totalWorkers: 0,
    isShuttingDown: false,
  };

  private readonly options: WorkerShutdownOptions = {
    gracefulTimeoutMs: parseInt(process.env.WORKER_GRACEFUL_TIMEOUT_MS || '20000', 10),
    jobCompletionTimeoutMs: parseInt(process.env.WORKER_JOB_TIMEOUT_MS || '15000', 10),
    forceTerminationTimeoutMs: parseInt(process.env.WORKER_FORCE_TIMEOUT_MS || '5000', 10),
    requeueIncompleteJobs: process.env.WORKER_REQUEUE_JOBS !== 'false',
    waitForJobCompletion: process.env.WORKER_WAIT_COMPLETION !== 'false',
  };

  constructor(private readonly workerOrchestration: WorkerOrchestrationService) {}

  /**
   * Gracefully shutdown all workers and handle job completion/requeue
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Worker shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.logger.log('Starting worker graceful shutdown...');

    try {
      // Initialize shutdown status
      await this.initializeShutdownStatus();

      // Phase 1: Stop accepting new jobs
      await this.stopAcceptingNewJobs();

      // Phase 2: Wait for active jobs to complete
      if (this.options.waitForJobCompletion) {
        await this.waitForJobCompletion();
      }

      // Phase 3: Requeue incomplete jobs
      if (this.options.requeueIncompleteJobs) {
        await this.requeueIncompleteJobs();
      }

      // Phase 4: Terminate workers
      await this.terminateWorkers();

      this.shutdownStatus.phase = 'completed';
      this.logger.log('Worker shutdown completed successfully');
    } catch (error) {
      this.logger.error('Error during worker shutdown:', error);
      throw error;
    }
  }

  /**
   * Initialize shutdown status by gathering current worker state
   */
  private async initializeShutdownStatus(): Promise<void> {
    try {
      const healthCheck = await this.workerOrchestration.getHealthCheck();
      const metrics = await this.workerOrchestration.getMetrics();

      this.shutdownStatus = {
        phase: 'stopping_new_jobs',
        activeJobs: metrics.activeJobs || 0,
        completedJobs: 0,
        requeuedJobs: 0,
        terminatedWorkers: 0,
        totalWorkers: healthCheck.totalWorkers || 0,
        isShuttingDown: true,
      };

      this.logger.log(
        `Shutdown initialized: ${this.shutdownStatus.totalWorkers} workers, ` +
          `${this.shutdownStatus.activeJobs} active jobs`,
      );
    } catch (error) {
      this.logger.error('Error initializing shutdown status:', error);
      // Continue with default values
    }
  }

  /**
   * Stop workers from accepting new jobs
   */
  private async stopAcceptingNewJobs(): Promise<void> {
    this.logger.log('Stopping workers from accepting new jobs...');
    this.shutdownStatus.phase = 'stopping_new_jobs';

    try {
      // Pause all queues to prevent new job processing
      await this.workerOrchestration.pauseAllQueues();

      this.logger.log('All queues paused - no new jobs will be processed');
    } catch (error) {
      this.logger.error('Error stopping new job acceptance:', error);
      throw error;
    }
  }

  /**
   * Wait for currently active jobs to complete
   */
  private async waitForJobCompletion(): Promise<void> {
    this.logger.log('Waiting for active jobs to complete...');
    this.shutdownStatus.phase = 'waiting_completion';

    const startTime = Date.now();
    const checkInterval = 1000; // Check every second

    return new Promise((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        const duration = Date.now() - startTime;
        const remainingJobs = this.shutdownStatus.activeJobs;

        this.logger.warn(
          `Timeout waiting for job completion after ${duration}ms. ` +
            `${remainingJobs} jobs still active`,
        );

        reject(new Error(`Timeout waiting for ${remainingJobs} active jobs`));
      }, this.options.jobCompletionTimeoutMs);

      const checkCompletion = async () => {
        try {
          const metrics = await this.workerOrchestration.getMetrics();
          const activeJobs = metrics.activeJobs || 0;

          this.shutdownStatus.activeJobs = activeJobs;
          this.shutdownStatus.completedJobs = metrics.completedJobs || 0;

          if (activeJobs === 0) {
            clearTimeout(timeoutTimer);
            const duration = Date.now() - startTime;
            this.logger.log(`All jobs completed after ${duration}ms`);
            resolve();
          } else {
            this.logger.debug(`Waiting for ${activeJobs} active jobs to complete...`);
            setTimeout(checkCompletion, checkInterval);
          }
        } catch (error) {
          clearTimeout(timeoutTimer);
          this.logger.error('Error checking job completion status:', error);
          // Continue with shutdown even if we can't check status
          resolve();
        }
      };

      checkCompletion();
    });
  }

  /**
   * Requeue incomplete jobs for processing after restart
   */
  private async requeueIncompleteJobs(): Promise<void> {
    this.logger.log('Requeuing incomplete jobs...');
    this.shutdownStatus.phase = 'requeuing';

    try {
      const requeuedCount = await this.workerOrchestration.requeueIncompleteJobs();
      this.shutdownStatus.requeuedJobs = requeuedCount;

      this.logger.log(`Requeued ${requeuedCount} incomplete jobs`);
    } catch (error) {
      this.logger.error('Error requeuing incomplete jobs:', error);
      // Continue with shutdown even if requeue fails
    }
  }

  /**
   * Terminate all worker processes
   */
  private async terminateWorkers(): Promise<void> {
    this.logger.log('Terminating worker processes...');
    this.shutdownStatus.phase = 'terminating';

    try {
      const terminatedCount = await this.workerOrchestration.terminateAllWorkers(
        this.options.forceTerminationTimeoutMs,
      );

      this.shutdownStatus.terminatedWorkers = terminatedCount;

      this.logger.log(`Terminated ${terminatedCount} worker processes`);
    } catch (error) {
      this.logger.error('Error terminating workers:', error);
      throw error;
    }
  }

  /**
   * Get current shutdown status
   */
  getShutdownStatus(): WorkerShutdownStatus & { options: WorkerShutdownOptions } {
    return {
      ...this.shutdownStatus,
      options: this.options,
    };
  }

  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get detailed worker statistics during shutdown
   */
  async getDetailedStatus(): Promise<{
    shutdown: WorkerShutdownStatus;
    workers: any;
    queues: any;
  }> {
    try {
      const [healthCheck, metrics] = await Promise.all([
        this.workerOrchestration.getHealthCheck(),
        this.workerOrchestration.getMetrics(),
      ]);

      return {
        shutdown: this.shutdownStatus,
        workers: healthCheck,
        queues: metrics,
      };
    } catch (error) {
      this.logger.error('Error getting detailed shutdown status:', error);
      return {
        shutdown: this.shutdownStatus,
        workers: null,
        queues: null,
      };
    }
  }

  /**
   * Emergency stop - force terminate everything immediately
   */
  async emergencyStop(): Promise<void> {
    this.logger.warn('Emergency worker stop initiated');

    try {
      await this.workerOrchestration.emergencyStopAll();
      this.shutdownStatus.phase = 'completed';
      this.logger.log('Emergency stop completed');
    } catch (error) {
      this.logger.error('Error during emergency stop:', error);
      throw error;
    }
  }

  /**
   * NestJS lifecycle hook
   */
  async onModuleDestroy(): Promise<void> {
    if (!this.isShuttingDown) {
      await this.shutdown();
    }
  }
}
