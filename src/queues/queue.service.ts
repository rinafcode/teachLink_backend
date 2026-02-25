import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { JobOptions, JobMetrics } from './interfaces/queue.interfaces';
import { JobPriority, JobStatus } from './enums/job-priority.enum';

/**
 * Core Queue Service
 * Provides centralized queue management with priority support
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('default') private readonly defaultQueue: Queue,
  ) {}

  /**
   * Add a job to the queue with priority and options
   */
  async addJob<T = any>(
    name: string,
    data: T,
    options?: JobOptions,
  ): Promise<Job<T>> {
    try {
      const job = await this.defaultQueue.add(name, data, {
        priority: options?.priority || JobPriority.NORMAL,
        attempts: options?.attempts || 3,
        backoff: options?.backoff || {
          type: 'exponential',
          delay: 2000,
        },
        delay: options?.delay,
        timeout: options?.timeout || 30000,
        removeOnComplete: options?.removeOnComplete ?? true,
        removeOnFail: options?.removeOnFail ?? false,
      });

      this.logger.log(
        `Job ${name} added to queue with ID: ${job.id}, Priority: ${options?.priority || JobPriority.NORMAL}`,
      );

      return job;
    } catch (error) {
      this.logger.error(`Failed to add job ${name}:`, error);
      throw error;
    }
  }

  /**
   * Add multiple jobs in bulk
   */
  async addBulkJobs<T = any>(
    jobs: Array<{ name: string; data: T; options?: JobOptions }>,
  ): Promise<Job<T>[]> {
    try {
      const bulkJobs = jobs.map((job) => ({
        name: job.name,
        data: job.data,
        opts: {
          priority: job.options?.priority || JobPriority.NORMAL,
          attempts: job.options?.attempts || 3,
          backoff: job.options?.backoff || {
            type: 'exponential',
            delay: 2000,
          },
        },
      }));

      const addedJobs = await this.defaultQueue.addBulk(bulkJobs);
      this.logger.log(`Added ${addedJobs.length} jobs in bulk`);
      return addedJobs;
    } catch (error) {
      this.logger.error('Failed to add bulk jobs:', error);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    return this.defaultQueue.getJob(jobId);
  }

  /**
   * Get job metrics
   */
  async getJobMetrics(jobId: string): Promise<JobMetrics | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();

    return {
      jobId: job.id.toString(),
      name: job.name,
      status: state as JobStatus,
      priority: job.opts.priority as JobPriority,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts || 3,
      progress: await job.progress(),
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      failedReason: job.failedReason,
      data: job.data,
    };
  }

  /**
   * Remove a job from the queue
   */
  async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`Job ${jobId} removed from queue`);
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.retry();
      this.logger.log(`Job ${jobId} retried`);
    }
  }

  /**
   * Pause the queue
   */
  async pauseQueue(): Promise<void> {
    await this.defaultQueue.pause();
    this.logger.log('Queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    await this.defaultQueue.resume();
    this.logger.log('Queue resumed');
  }

  /**
   * Clean old jobs from the queue
   */
  async cleanQueue(
    grace: number = 5000,
    status?: 'completed' | 'failed',
  ): Promise<void> {
    if (status) {
      await this.defaultQueue.clean(grace, status);
      this.logger.log(`Cleaned ${status} jobs older than ${grace}ms`);
    } else {
      await this.defaultQueue.clean(grace, 'completed');
      await this.defaultQueue.clean(grace, 'failed');
      this.logger.log(`Cleaned all jobs older than ${grace}ms`);
    }
  }

  /**
   * Get queue counts
   */
  async getQueueCounts() {
    return {
      waiting: await this.defaultQueue.getWaitingCount(),
      active: await this.defaultQueue.getActiveCount(),
      completed: await this.defaultQueue.getCompletedCount(),
      failed: await this.defaultQueue.getFailedCount(),
      delayed: await this.defaultQueue.getDelayedCount(),
      paused: await this.defaultQueue.getPausedCount(),
    };
  }

  /**
   * Empty the queue (remove all jobs)
   */
  async emptyQueue(): Promise<void> {
    await this.defaultQueue.empty();
    this.logger.warn('Queue emptied - all jobs removed');
  }
}
