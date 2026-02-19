import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { JobOptions } from '../interfaces/queue.interfaces';
import { JobPriority } from '../enums/job-priority.enum';

/**
 * Job Scheduler Service
 * Handles scheduled and recurring jobs with cron support
 */
@Injectable()
export class JobSchedulerService {
  private readonly logger = new Logger(JobSchedulerService.name);

  constructor(
    @InjectQueue('default') private readonly defaultQueue: Queue,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  /**
   * Schedule a job to run at a specific time
   */
  async scheduleJob<T = any>(
    name: string,
    data: T,
    scheduledTime: Date,
    options?: JobOptions,
  ): Promise<string> {
    const delay = scheduledTime.getTime() - Date.now();

    if (delay < 0) {
      throw new Error('Scheduled time must be in the future');
    }

    const job = await this.defaultQueue.add(name, data, {
      ...options,
      delay,
    });

    this.logger.log(
      `Job ${name} scheduled for ${scheduledTime.toISOString()} (ID: ${job.id})`,
    );

    return job.id.toString();
  }

  /**
   * Schedule a recurring job with cron expression
   */
  scheduleRecurringJob(
    name: string,
    cronExpression: string,
    callback: () => Promise<void>,
  ): void {
    try {
      const job = new CronJob(cronExpression, async () => {
        this.logger.log(`Executing recurring job: ${name}`);
        try {
          await callback();
        } catch (error) {
          this.logger.error(`Error in recurring job ${name}:`, error);
        }
      });

      this.schedulerRegistry.addCronJob(name, job);
      job.start();

      this.logger.log(
        `Recurring job ${name} scheduled with cron: ${cronExpression}`,
      );
    } catch (error) {
      this.logger.error(`Failed to schedule recurring job ${name}:`, error);
      throw error;
    }
  }

  /**
   * Remove a scheduled recurring job
   */
  removeRecurringJob(name: string): void {
    try {
      const job = this.schedulerRegistry.getCronJob(name);
      job.stop();
      this.schedulerRegistry.deleteCronJob(name);
      this.logger.log(`Recurring job ${name} removed`);
    } catch (error) {
      this.logger.error(`Failed to remove recurring job ${name}:`, error);
    }
  }

  /**
   * Schedule a job to run after a delay
   */
  async scheduleDelayedJob<T = any>(
    name: string,
    data: T,
    delayMs: number,
    options?: JobOptions,
  ): Promise<string> {
    const job = await this.defaultQueue.add(name, data, {
      ...options,
      delay: delayMs,
    });

    this.logger.log(
      `Job ${name} scheduled with ${delayMs}ms delay (ID: ${job.id})`,
    );

    return job.id.toString();
  }

  /**
   * Schedule a batch of jobs
   */
  async scheduleBatchJobs<T = any>(
    jobs: Array<{
      name: string;
      data: T;
      scheduledTime: Date;
      options?: JobOptions;
    }>,
  ): Promise<string[]> {
    const jobIds: string[] = [];

    for (const job of jobs) {
      const id = await this.scheduleJob(
        job.name,
        job.data,
        job.scheduledTime,
        job.options,
      );
      jobIds.push(id);
    }

    this.logger.log(`Scheduled ${jobIds.length} jobs in batch`);
    return jobIds;
  }

  /**
   * Get all scheduled jobs
   */
  async getScheduledJobs(): Promise<any[]> {
    const delayed = await this.defaultQueue.getDelayed();
    return delayed.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      scheduledFor: new Date(job.timestamp + (job.opts.delay || 0)),
      priority: job.opts.priority,
    }));
  }

  /**
   * Cancel a scheduled job
   */
  async cancelScheduledJob(jobId: string): Promise<void> {
    const job = await this.defaultQueue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`Scheduled job ${jobId} cancelled`);
    }
  }

  /**
   * Reschedule a job
   */
  async rescheduleJob(
    jobId: string,
    newScheduledTime: Date,
  ): Promise<string> {
    const job = await this.defaultQueue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Remove old job
    await job.remove();

    // Create new job with same data
    const newJobId = await this.scheduleJob(
      job.name,
      job.data,
      newScheduledTime,
      job.opts as any,
    );

    this.logger.log(
      `Job ${jobId} rescheduled to ${newScheduledTime.toISOString()} (new ID: ${newJobId})`,
    );

    return newJobId;
  }

  /**
   * Example: Daily cleanup job
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyCleanup(): Promise<void> {
    this.logger.log('Running daily cleanup job');
    try {
      // Clean completed jobs older than 24 hours
      await this.defaultQueue.clean(24 * 60 * 60 * 1000, 'completed');
      // Clean failed jobs older than 7 days
      await this.defaultQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed');
      this.logger.log('Daily cleanup completed');
    } catch (error) {
      this.logger.error('Error during daily cleanup:', error);
    }
  }

  /**
   * Example: Hourly metrics collection
   */
  @Cron(CronExpression.EVERY_HOUR)
  async hourlyMetrics(): Promise<void> {
    this.logger.log('Collecting hourly metrics');
    try {
      const counts = {
        waiting: await this.defaultQueue.getWaitingCount(),
        active: await this.defaultQueue.getActiveCount(),
        completed: await this.defaultQueue.getCompletedCount(),
        failed: await this.defaultQueue.getFailedCount(),
      };
      this.logger.log('Hourly metrics:', counts);
    } catch (error) {
      this.logger.error('Error collecting hourly metrics:', error);
    }
  }

  /**
   * Schedule job with retry on specific days/times
   */
  async scheduleWithBusinessHours<T = any>(
    name: string,
    data: T,
    options?: JobOptions,
  ): Promise<string> {
    const now = new Date();
    let scheduledTime = new Date(now);

    // If outside business hours (9 AM - 5 PM), schedule for next business day at 9 AM
    const hour = now.getHours();
    if (hour < 9 || hour >= 17) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
      scheduledTime.setHours(9, 0, 0, 0);
    }

    // Skip weekends
    const day = scheduledTime.getDay();
    if (day === 0) {
      // Sunday -> Monday
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    } else if (day === 6) {
      // Saturday -> Monday
      scheduledTime.setDate(scheduledTime.getDate() + 2);
    }

    return this.scheduleJob(name, data, scheduledTime, options);
  }

  /**
   * Get all active cron jobs
   */
  getActiveCronJobs(): string[] {
    return Array.from(this.schedulerRegistry.getCronJobs().keys());
  }
}
