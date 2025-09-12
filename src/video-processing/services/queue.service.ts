import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Repository } from 'typeorm';
import {
  type VideoProcessingJob,
  JobStatus,
  JobPriority,
} from '../entities/video-processing-job.entity';
import {
  type ProcessingQueue,
  QueueStatus,
} from '../entities/processing-queue.entity';
import type { WorkerService } from './worker.service';

export interface QueueStats {
  queueName: string;
  totalJobs: number;
  queuedJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  throughput: number; // jobs per hour
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<string, ProcessingQueue>();
  private readonly activeJobs = new Map<string, VideoProcessingJob>();
  private schedulerInterval: NodeJS.Timeout | null = null;
  private readonly SCHEDULER_INTERVAL = 5000; // 5 seconds

  constructor(
    private readonly jobRepository: Repository<VideoProcessingJob>,
    private readonly queueRepository: Repository<ProcessingQueue>,
    private readonly workerService: WorkerService,
  ) {}

  async onModuleInit() {
    await this.initializeQueues();
    this.startScheduler();
    this.logger.log('Queue service initialized');
  }

  async onModuleDestroy() {
    this.stopScheduler();
    await this.gracefulShutdown();
    this.logger.log('Queue service destroyed');
  }

  private async initializeQueues() {
    // Create default queues if they don't exist
    const defaultQueues = [
      {
        name: 'high-priority',
        description: 'High priority video processing jobs',
        priority: 10,
        maxConcurrentJobs: 2,
      },
      {
        name: 'normal-priority',
        description: 'Normal priority video processing jobs',
        priority: 5,
        maxConcurrentJobs: 5,
      },
      {
        name: 'low-priority',
        description: 'Low priority video processing jobs',
        priority: 1,
        maxConcurrentJobs: 10,
      },
      {
        name: 'thumbnail-generation',
        description: 'Thumbnail and preview generation jobs',
        priority: 3,
        maxConcurrentJobs: 8,
      },
    ];

    for (const queueConfig of defaultQueues) {
      let queue = await this.queueRepository.findOne({
        where: { name: queueConfig.name },
      });

      if (!queue) {
        queue = this.queueRepository.create(queueConfig);
        await this.queueRepository.save(queue);
      }

      this.queues.set(queue.name, queue);
    }
  }

  private startScheduler() {
    this.schedulerInterval = setInterval(async () => {
      try {
        await this.processQueues();
      } catch (error) {
        this.logger.error('Error in queue scheduler', error.stack);
      }
    }, this.SCHEDULER_INTERVAL);
  }

  private stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  async addJob(job: VideoProcessingJob): Promise<void> {
    const queueName = this.getQueueNameForJob(job);
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    job.status = JobStatus.QUEUED;
    job.scheduledAt = new Date();
    await this.jobRepository.save(job);

    this.logger.log(`Job ${job.id} added to queue ${queueName}`);
  }

  private async processQueues() {
    const activeQueues = Array.from(this.queues.values())
      .filter((queue) => queue.status === QueueStatus.ACTIVE)
      .sort((a, b) => b.priority - a.priority);

    for (const queue of activeQueues) {
      await this.processQueue(queue);
    }
  }

  private async processQueue(queue: ProcessingQueue) {
    const availableSlots = queue.maxConcurrentJobs - queue.currentActiveJobs;

    if (availableSlots <= 0) {
      return;
    }

    const queuedJobs = await this.jobRepository.find({
      where: { status: JobStatus.QUEUED },
      order: { priority: 'DESC', createdAt: 'ASC' },
      take: availableSlots,
      relations: ['video'],
    });

    const jobsForQueue = queuedJobs.filter(
      (job) => this.getQueueNameForJob(job) === queue.name,
    );

    for (const job of jobsForQueue) {
      try {
        await this.startJobProcessing(job, queue);
      } catch (error) {
        this.logger.error(`Failed to start job ${job.id}`, error.stack);
        await this.markJobFailed(job, error.message);
      }
    }
  }

  private async startJobProcessing(
    job: VideoProcessingJob,
    queue: ProcessingQueue,
  ) {
    job.status = JobStatus.PROCESSING;
    job.startedAt = new Date();
    job.workerId = this.generateWorkerId();
    await this.jobRepository.save(job);

    // Update queue active job count
    queue.currentActiveJobs += 1;
    await this.queueRepository.save(queue);

    this.activeJobs.set(job.id, job);

    this.logger.log(`Started processing job ${job.id} in queue ${queue.name}`);

    // Process job asynchronously
    this.workerService
      .processJob(job)
      .then(async (result) => {
        await this.completeJob(job, result);
      })
      .catch(async (error) => {
        await this.handleJobError(job, error);
      });
  }

  private async completeJob(job: VideoProcessingJob, result: any) {
    job.status = JobStatus.COMPLETED;
    job.completedAt = new Date();
    job.result = result;
    job.progress = 100;

    if (job.startedAt) {
      job.actualDuration = Math.floor(
        (job.completedAt.getTime() - job.startedAt.getTime()) / 1000,
      );
    }

    await this.jobRepository.save(job);
    await this.releaseJobSlot(job);

    this.activeJobs.delete(job.id);
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  private async handleJobError(job: VideoProcessingJob, error: Error) {
    job.error = error.message;
    job.retryCount += 1;

    if (job.retryCount < job.maxRetries) {
      // Schedule retry
      job.status = JobStatus.RETRYING;
      job.scheduledAt = new Date(
        Date.now() + this.getRetryDelay(job.retryCount),
      );
      this.logger.warn(
        `Job ${job.id} failed, scheduling retry ${job.retryCount}/${job.maxRetries}`,
      );
    } else {
      // Mark as failed
      job.status = JobStatus.FAILED;
      job.completedAt = new Date();
      this.logger.error(
        `Job ${job.id} failed permanently after ${job.retryCount} retries`,
      );
    }

    await this.jobRepository.save(job);
    await this.releaseJobSlot(job);
    this.activeJobs.delete(job.id);
  }

  private async markJobFailed(job: VideoProcessingJob, error: string) {
    job.status = JobStatus.FAILED;
    job.error = error;
    job.completedAt = new Date();
    await this.jobRepository.save(job);
  }

  private async releaseJobSlot(job: VideoProcessingJob) {
    const queueName = this.getQueueNameForJob(job);
    const queue = this.queues.get(queueName);

    if (queue && queue.currentActiveJobs > 0) {
      queue.currentActiveJobs -= 1;
      await this.queueRepository.save(queue);
    }
  }

  private getQueueNameForJob(job: VideoProcessingJob): string {
    switch (job.priority) {
      case JobPriority.URGENT:
      case JobPriority.HIGH:
        return 'high-priority';
      case JobPriority.NORMAL:
        return job.type === 'thumbnail_generation'
          ? 'thumbnail-generation'
          : 'normal-priority';
      case JobPriority.LOW:
      default:
        return 'low-priority';
    }
  }

  private getRetryDelay(retryCount: number): number {
    // Exponential backoff: 30s, 2m, 8m, 32m...
    return Math.min(30 * 1000 * Math.pow(4, retryCount - 1), 30 * 60 * 1000);
  }

  private generateWorkerId(): string {
    return `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async getQueueStats(): Promise<QueueStats[]> {
    const stats: QueueStats[] = [];

    for (const queue of this.queues.values()) {
      const queueStats = await this.calculateQueueStats(queue);
      stats.push(queueStats);
    }

    return stats;
  }

  private async calculateQueueStats(
    queue: ProcessingQueue,
  ): Promise<QueueStats> {
    const queueName = this.getQueueNameForJob({
      priority: queue.priority,
    } as VideoProcessingJob);

    const [totalJobs, queuedJobs, processingJobs, completedJobs, failedJobs] =
      await Promise.all([
        this.jobRepository.count(),
        this.jobRepository.count({ where: { status: JobStatus.QUEUED } }),
        this.jobRepository.count({ where: { status: JobStatus.PROCESSING } }),
        this.jobRepository.count({ where: { status: JobStatus.COMPLETED } }),
        this.jobRepository.count({ where: { status: JobStatus.FAILED } }),
      ]);

    // Calculate average processing time from completed jobs
    const completedJobsWithDuration = await this.jobRepository.find({
      where: { status: JobStatus.COMPLETED },
      select: ['actualDuration'],
      take: 100, // Sample last 100 jobs
      order: { completedAt: 'DESC' },
    });

    const averageProcessingTime =
      completedJobsWithDuration.length > 0
        ? completedJobsWithDuration.reduce(
            (sum, job) => sum + (job.actualDuration || 0),
            0,
          ) / completedJobsWithDuration.length
        : 0;

    // Calculate throughput (jobs per hour) based on last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCompletedJobs = await this.jobRepository.count({
      where: {
        status: JobStatus.COMPLETED,
        completedAt: { $gte: oneDayAgo } as any,
      },
    });

    const throughput = recentCompletedJobs; // jobs per 24 hours

    return {
      queueName: queue.name,
      totalJobs,
      queuedJobs,
      processingJobs,
      completedJobs,
      failedJobs,
      averageProcessingTime,
      throughput,
    };
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    queue.status = QueueStatus.PAUSED;
    await this.queueRepository.save(queue);
    this.logger.log(`Queue ${queueName} paused`);
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    queue.status = QueueStatus.ACTIVE;
    await this.queueRepository.save(queue);
    this.logger.log(`Queue ${queueName} resumed`);
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === JobStatus.PROCESSING) {
      // Signal worker to cancel job
      await this.workerService.cancelJob(jobId);
    }

    job.status = JobStatus.CANCELLED;
    job.completedAt = new Date();
    await this.jobRepository.save(job);

    if (this.activeJobs.has(jobId)) {
      await this.releaseJobSlot(job);
      this.activeJobs.delete(jobId);
    }

    this.logger.log(`Job ${jobId} cancelled`);
  }

  async retryJob(jobId: string): Promise<void> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== JobStatus.FAILED) {
      throw new Error(`Job ${jobId} is not in failed state`);
    }

    job.status = JobStatus.QUEUED;
    job.error = null;
    job.retryCount = 0;
    job.scheduledAt = new Date();
    job.startedAt = null;
    job.completedAt = null;
    job.progress = 0;

    await this.jobRepository.save(job);
    this.logger.log(`Job ${jobId} queued for retry`);
  }

  private async gracefulShutdown() {
    this.logger.log('Starting graceful shutdown...');

    // Wait for active jobs to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (
      this.activeJobs.size > 0 &&
      Date.now() - startTime < shutdownTimeout
    ) {
      this.logger.log(
        `Waiting for ${this.activeJobs.size} active jobs to complete...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (this.activeJobs.size > 0) {
      this.logger.warn(
        `Forcing shutdown with ${this.activeJobs.size} active jobs remaining`,
      );
      // Mark remaining jobs as failed
      for (const job of this.activeJobs.values()) {
        await this.markJobFailed(job, 'Server shutdown');
      }
    }

    this.logger.log('Graceful shutdown completed');
  }
}
