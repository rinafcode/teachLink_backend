import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, JobStatus } from '../interfaces/job.interface';
import { QueueService } from '../queue.service';
import { CronJob } from 'cron';

/**
 * Interface for recurring job definition
 */
export interface RecurringJob {
  id: string;
  name: string;
  data: any;
  cronExpression: string;
  options?: {
    priority?: number;
    maxAttempts?: number;
    timeout?: number;
  };
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
  timezone?: string;
  description?: string;
  tags?: string[];
}

/**
 * Service for scheduling and managing jobs
 */
@Injectable()
export class JobSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(JobSchedulerService.name);
  private recurringJobs: Map<string, RecurringJob> = new Map();
  private cronJobs: Map<string, CronJob> = new Map();
  private schedulerRunning = false;

  constructor(private readonly queueService: QueueService) {}

  /**
   * Initialize scheduler when module starts
   */
  onModuleInit() {
    this.startScheduler();
  }

  /**
   * Start the job scheduler
   */
  startScheduler(): void {
    if (this.schedulerRunning) {
      return;
    }

    this.logger.log('Starting job scheduler');
    this.schedulerRunning = true;

    // Start all registered cron jobs
    for (const [id, recurringJob] of this.recurringJobs.entries()) {
      if (recurringJob.enabled) {
        this.startCronJob(id, recurringJob);
      }
    }

    // Also set up a periodic check for one-time scheduled jobs
    setInterval(() => this.processScheduledJobs(), 10000); // Check every 10 seconds
  }

  /**
   * Stop the job scheduler
   */
  stopScheduler(): void {
    if (!this.schedulerRunning) {
      return;
    }

    this.logger.log('Stopping job scheduler');
    this.schedulerRunning = false;

    // Stop all cron jobs
    for (const [id, cronJob] of this.cronJobs.entries()) {
      cronJob.stop();
      this.cronJobs.delete(id);
    }
  }

  /**
   * Schedule a job to run at a specific time
   */
  async scheduleJob(job: Partial<Job> & { name: string; data: any }, scheduledTime: Date): Promise<Job> {
    // Create a job with scheduled time
    const scheduledJob: Partial<Job> = {
      ...job,
      status: JobStatus.PENDING,
      scheduledFor: scheduledTime,
    };

    // Add to queue
    const createdJob = await this.queueService.addJob(scheduledJob);
    this.logger.log(`Scheduled job ${createdJob.id} (${createdJob.name}) for ${scheduledTime.toISOString()}`);

    return createdJob;
  }

  /**
   * Add a recurring job using cron expression
   */
  addRecurringJob(recurringJob: Omit<RecurringJob, 'id'>): RecurringJob {
    // Generate ID if not provided
    const id = `recurring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newRecurringJob: RecurringJob = {
      id,
      ...recurringJob,
      enabled: recurringJob.enabled !== undefined ? recurringJob.enabled : true,
    };

    // Store recurring job definition
    this.recurringJobs.set(id, newRecurringJob);

    // Start the cron job if scheduler is running and job is enabled
    if (this.schedulerRunning && newRecurringJob.enabled) {
      this.startCronJob(id, newRecurringJob);
    }

    this.logger.log(`Added recurring job ${id} (${newRecurringJob.name}) with cron: ${newRecurringJob.cronExpression}`);
    
    return newRecurringJob;
  }

  /**
   * Update a recurring job
   */
  updateRecurringJob(id: string, updates: Partial<RecurringJob>): RecurringJob | null {
    const existingJob = this.recurringJobs.get(id);
    
    if (!existingJob) {
      return null;
    }

    // Stop existing cron job if running
    if (this.cronJobs.has(id)) {
      this.cronJobs.get(id)?.stop();
      this.cronJobs.delete(id);
    }

    // Update job definition
    const updatedJob: RecurringJob = {
      ...existingJob,
      ...updates,
    };

    this.recurringJobs.set(id, updatedJob);

    // Restart cron job if enabled and scheduler is running
    if (this.schedulerRunning && updatedJob.enabled) {
      this.startCronJob(id, updatedJob);
    }

    this.logger.log(`Updated recurring job ${id} (${updatedJob.name})`);
    
    return updatedJob;
  }

  /**
   * Remove a recurring job
   */
  removeRecurringJob(id: string): boolean {
    if (!this.recurringJobs.has(id)) {
      return false;
    }

    // Stop cron job if running
    if (this.cronJobs.has(id)) {
      this.cronJobs.get(id)?.stop();
      this.cronJobs.delete(id);
    }

    // Remove job definition
    this.recurringJobs.delete(id);
    this.logger.log(`Removed recurring job ${id}`);
    
    return true;
  }

  /**
   * Enable a recurring job
   */
  enableRecurringJob(id: string): boolean {
    const job = this.recurringJobs.get(id);
    
    if (!job) {
      return false;
    }

    job.enabled = true;
    this.recurringJobs.set(id, job);

    // Start cron job if scheduler is running
    if (this.schedulerRunning && !this.cronJobs.has(id)) {
      this.startCronJob(id, job);
    }

    this.logger.log(`Enabled recurring job ${id} (${job.name})`);
    
    return true;
  }

  /**
   * Disable a recurring job
   */
  disableRecurringJob(id: string): boolean {
    const job = this.recurringJobs.get(id);
    
    if (!job) {
      return false;
    }

    job.enabled = false;
    this.recurringJobs.set(id, job);

    // Stop cron job if running
    if (this.cronJobs.has(id)) {
      this.cronJobs.get(id)?.stop();
      this.cronJobs.delete(id);
    }

    this.logger.log(`Disabled recurring job ${id} (${job.name})`);
    
    return true;
  }

  /**
   * Get all recurring jobs
   */
  getRecurringJobs(): RecurringJob[] {
    return Array.from(this.recurringJobs.values());
  }

  /**
   * Get a specific recurring job
   */
  getRecurringJob(id: string): RecurringJob | null {
    return this.recurringJobs.get(id) || null;
  }

  /**
   * Get recurring jobs by tag
   */
  getRecurringJobsByTag(tag: string): RecurringJob[] {
    return Array.from(this.recurringJobs.values())
      .filter(job => job.tags?.includes(tag));
  }

  /**
   * Start a cron job for a recurring job definition
   */
  private startCronJob(id: string, recurringJob: RecurringJob): void {
    try {
      // Create cron job
      const cronJob = new CronJob(
        recurringJob.cronExpression,
        () => this.executeRecurringJob(id, recurringJob),
        null,
        true,
        recurringJob.timezone
      );

      // Store cron job reference
      this.cronJobs.set(id, cronJob);

      // Calculate and store next run time
      const nextRun = cronJob.nextDate().toDate();
      recurringJob.nextRun = nextRun;
      this.recurringJobs.set(id, recurringJob);

      this.logger.log(`Started cron job ${id} (${recurringJob.name}), next run: ${nextRun.toISOString()}`);
    } catch (error) {
      this.logger.error(`Failed to start cron job ${id} (${recurringJob.name}): ${error.message}`, error.stack);
    }
  }

  /**
   * Execute a recurring job
   */
  private async executeRecurringJob(id: string, recurringJob: RecurringJob): Promise<void> {
    try {
      this.logger.log(`Executing recurring job ${id} (${recurringJob.name})`);

      // Create job from recurring job definition
      const job: Partial<Job> = {
        name: recurringJob.name,
        data: recurringJob.data,
        priority: recurringJob.options?.priority,
        maxAttempts: recurringJob.options?.maxAttempts,
        options: {
          timeout: recurringJob.options?.timeout,
          // Add metadata to identify this as a recurring job execution
          recurringJobId: id,
        },
      };

      // Add to queue for immediate processing
      await this.queueService.addJob(job);

      // Update last run time
      recurringJob.lastRun = new Date();
      
      // Calculate next run time
      const cronJob = this.cronJobs.get(id);
      if (cronJob) {
        recurringJob.nextRun = cronJob.nextDate().toDate();
      }
      
      this.recurringJobs.set(id, recurringJob);
    } catch (error) {
      this.logger.error(`Error executing recurring job ${id} (${recurringJob.name}): ${error.message}`, error.stack);
    }
  }

  /**
   * Process scheduled one-time jobs that are due
   */
  private async processScheduledJobs(): Promise<void> {
    if (!this.schedulerRunning) {
      return;
    }

    try {
      const now = new Date();
      
      // Get pending jobs with scheduledFor time in the past
      const dueJobs = await this.queueService.getJobsByFilter({
        status: JobStatus.PENDING,
        scheduledBefore: now,
        limit: 100,
      });

      if (dueJobs.length === 0) {
        return;
      }

      this.logger.log(`Processing ${dueJobs.length} scheduled jobs that are due`);

      // Process each due job
      for (const job of dueJobs) {
        try {
          // Mark job as ready for processing
          job.scheduledFor = undefined; // Clear scheduled time
          await this.queueService.updateJob(job);
          
          this.logger.debug(`Scheduled job ${job.id} (${job.name}) is now ready for processing`);
        } catch (error) {
          this.logger.error(`Error processing scheduled job ${job.id}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error in processScheduledJobs: ${error.message}`, error.stack);
    }
  }

  /**
   * Run a recurring job immediately (out of schedule)
   */
  async runRecurringJobNow(id: string): Promise<Job | null> {
    const recurringJob = this.recurringJobs.get(id);
    
    if (!recurringJob) {
      return null;
    }

    try {
      // Create job from recurring job definition
      const job: Partial<Job> = {
        name: recurringJob.name,
        data: recurringJob.data,
        priority: recurringJob.options?.priority,
        maxAttempts: recurringJob.options?.maxAttempts,
        options: {
          timeout: recurringJob.options?.timeout,
          recurringJobId: id,
          manualExecution: true,
        },
      };

      // Add to queue for immediate processing
      const createdJob = await this.queueService.addJob(job);

      // Update last run time
      recurringJob.lastRun = new Date();
      this.recurringJobs.set(id, recurringJob);

      this.logger.log(`Manually executed recurring job ${id} (${recurringJob.name})`);
      
      return createdJob;
    } catch (error) {
      this.logger.error(`Error executing recurring job ${id} manually: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Get the status of the scheduler
   */
  getSchedulerStatus(): Record<string, any> {
    return {
      running: this.schedulerRunning,
      recurringJobCount: this.recurringJobs.size,
      activeJobCount: this.cronJobs.size,
      nextJobs: Array.from(this.recurringJobs.values())
        .filter(job => job.enabled && job.nextRun)
        .sort((a, b) => (a.nextRun?.getTime() || 0) - (b.nextRun?.getTime() || 0))
        .slice(0, 5)
        .map(job => ({
          id: job.id,
          name: job.name,
          nextRun: job.nextRun,
          cronExpression: job.cronExpression,
        })),
    };
  }
}