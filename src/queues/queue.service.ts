import { Injectable, Logger } from '@nestjs/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { CreateJobDto, JobQueryDto, UpdateJobDto } from './dto/job.dto';
import { Job, JobOptions, JobStatus } from './interfaces/job.interface';
import { JobProgress, Queue, QueueMetrics } from './interfaces/queue.interface';

/**
 * Core queue service for job management
 */
@Injectable()
export class QueueService implements Queue {
  private readonly logger = new Logger(QueueService.name);
  private readonly jobs = new Map<string, Job>();
  private readonly jobsByStatus = new Map<JobStatus, Set<string>>();
  private readonly jobsByName = new Map<string, Set<string>>();
  
  // Observables for job events
  private readonly completedSubject = new Subject<Job>();
  private readonly failedSubject = new Subject<Job>();
  private readonly progressSubject = new Subject<JobProgress>();
  
  // Queue state
  private paused = false;
  private processing = false;
  private readonly metrics: QueueMetrics = {
    name: 'default',
    counts: {
      [JobStatus.PENDING]: 0,
      [JobStatus.ACTIVE]: 0,
      [JobStatus.COMPLETED]: 0,
      [JobStatus.FAILED]: 0,
      [JobStatus.DELAYED]: 0,
      [JobStatus.RETRYING]: 0,
    },
    averageProcessingTime: 0,
    throughput: 0,
    errorRate: 0,
    latency: 0,
    isPaused: false,
    workerCount: 1,
  };
  
  // Performance tracking
  private processingTimes: number[] = [];
  private lastProcessedJobs = 0;
  private lastErrorCount = 0;
  private metricsInterval: NodeJS.Timeout;
  
  constructor() {
    // Initialize status maps
    Object.values(JobStatus).forEach(status => {
      this.jobsByStatus.set(status, new Set<string>());
    });
    
    // Start metrics calculation
    this.metricsInterval = setInterval(() => this.calculateMetrics(), 5000);
  }
  
  /**
   * Add a job to the queue
   */
  async add<T>(name: string, data: T, options?: JobOptions): Promise<Job<T>> {
    const id = uuidv4();
    const now = new Date();
    
    const job: Job<T> = {
      id,
      name,
      data,
      priority: options?.backoff?.delay || 0,
      createdAt: now,
      attempts: 0,
      maxAttempts: options?.retryStrategy ? 3 : 0,
      status: JobStatus.PENDING,
      options,
    };
    
    this.jobs.set(id, job as Job);
    this.addToStatusSet(job.id, job.status);
    this.addToNameSet(job.name, job.id);
    
    this.logger.debug(`Added job ${id} to queue with name ${name}`);
    return job;
  }
  
  /**
   * Schedule a job for future processing
   */
  async schedule<T>(name: string, data: T, scheduledFor: Date, options?: JobOptions): Promise<Job<T>> {
    const job = await this.add(name, data, options) as Job<T>;
    
    // Update job with scheduled time
    job.scheduledFor = scheduledFor;
    job.status = JobStatus.DELAYED;
    
    // Update status tracking
    this.removeFromStatusSet(job.id, JobStatus.PENDING);
    this.addToStatusSet(job.id, JobStatus.DELAYED);
    
    this.logger.debug(`Scheduled job ${job.id} for ${scheduledFor.toISOString()}`);
    return job;
  }
  
  /**
   * Process jobs from the queue
   */
  process<R = any>(processor: (job: Job) => Promise<R>): void {
    if (this.processing) {
      this.logger.warn('Queue processor already running');
      return;
    }
    
    this.processing = true;
    this.logger.log('Starting queue processor');
    
    // Start processing loop
    this.processNextJob(processor);
  }
  
  /**
   * Process the next job in the queue
   */
  private async processNextJob<R>(processor: (job: Job) => Promise<R>): Promise<void> {
    if (this.paused) {
      setTimeout(() => this.processNextJob(processor), 1000);
      return;
    }
    
    // Check for scheduled jobs that are ready
    await this.checkScheduledJobs();
    
    // Get next job by priority
    const job = await this.getNextJob();
    
    if (!job) {
      // No jobs to process, wait and check again
      setTimeout(() => this.processNextJob(processor), 100);
      return;
    }
    
    // Update job status
    job.status = JobStatus.ACTIVE;
    job.attempts += 1;
    job.lastAttemptedAt = new Date();
    
    // Update status tracking
    this.removeFromStatusSet(job.id, JobStatus.PENDING);
    this.addToStatusSet(job.id, JobStatus.ACTIVE);
    
    const startTime = Date.now();
    
    try {
      // Process the job
      this.logger.debug(`Processing job ${job.id} (${job.name}), attempt ${job.attempts}`);
      const result = await processor(job);
      
      // Job completed successfully
      job.status = JobStatus.COMPLETED;
      this.removeFromStatusSet(job.id, JobStatus.ACTIVE);
      this.addToStatusSet(job.id, JobStatus.COMPLETED);
      
      // Track processing time
      const processingTime = Date.now() - startTime;
      this.processingTimes.push(processingTime);
      
      // Emit completion event
      this.completedSubject.next(job);
      
      // Clean up if needed
      if (job.options?.removeOnComplete) {
        await this.removeJob(job.id);
      }
      
      this.logger.debug(`Job ${job.id} completed in ${processingTime}ms`);
    } catch (error) {
      // Job failed
      job.lastError = error;
      
      if (job.attempts >= job.maxAttempts) {
        // Max attempts reached, mark as failed
        job.status = JobStatus.FAILED;
        this.removeFromStatusSet(job.id, JobStatus.ACTIVE);
        this.addToStatusSet(job.id, JobStatus.FAILED);
        
        // Emit failure event
        this.failedSubject.next(job);
        
        // Clean up if needed
        if (job.options?.removeOnFail) {
          await this.removeJob(job.id);
        }
        
        this.logger.error(`Job ${job.id} failed after ${job.attempts} attempts: ${error.message}`);
      } else {
        // Retry the job with backoff
        job.status = JobStatus.RETRYING;
        this.removeFromStatusSet(job.id, JobStatus.ACTIVE);
        this.addToStatusSet(job.id, JobStatus.RETRYING);
        
        // Calculate backoff delay
        const backoffDelay = this.calculateBackoff(job);
        
        // Schedule retry
        setTimeout(() => {
          job.status = JobStatus.PENDING;
          this.removeFromStatusSet(job.id, JobStatus.RETRYING);
          this.addToStatusSet(job.id, JobStatus.PENDING);
          this.logger.debug(`Job ${job.id} scheduled for retry (attempt ${job.attempts + 1})`);
        }, backoffDelay);
        
        this.logger.warn(`Job ${job.id} failed, retrying in ${backoffDelay}ms: ${error.message}`);
      }
    }
    
    // Process next job
    setImmediate(() => this.processNextJob(processor));
  }
  
  /**
   * Calculate backoff delay for retries
   */
  private calculateBackoff(job: Job): number {
    const { retryStrategy, backoff } = job.options || {};
    const baseDelay = backoff?.delay || 1000;
    
    switch (retryStrategy) {
      case 'exponential':
        return baseDelay * Math.pow(2, job.attempts - 1);
      case 'linear':
        return baseDelay * job.attempts;
      case 'fixed':
      default:
        return baseDelay;
    }
  }
  
  /**
   * Check for scheduled jobs that are ready to be processed
   */
  private async checkScheduledJobs(): Promise<void> {
    const now = new Date();
    const delayedJobIds = Array.from(this.jobsByStatus.get(JobStatus.DELAYED) || []);
    
    for (const jobId of delayedJobIds) {
      const job = this.jobs.get(jobId);
      
      if (job && job.scheduledFor && job.scheduledFor <= now) {
        // Job is ready to be processed
        job.status = JobStatus.PENDING;
        this.removeFromStatusSet(job.id, JobStatus.DELAYED);
        this.addToStatusSet(job.id, JobStatus.PENDING);
        this.logger.debug(`Scheduled job ${job.id} is now ready for processing`);
      }
    }
  }
  
  /**
   * Get the next job to process based on priority
   */
  private async getNextJob(): Promise<Job | null> {
    const pendingJobIds = Array.from(this.jobsByStatus.get(JobStatus.PENDING) || []);
    
    if (pendingJobIds.length === 0) {
      return null;
    }
    
    // Sort by priority (higher number = higher priority)
    const sortedJobs = pendingJobIds
      .map(id => this.jobs.get(id))
      .filter(job => job !== undefined)
      .sort((a, b) => b.priority - a.priority);
    
    return sortedJobs[0] || null;
  }
  
  /**
   * Get a job by ID
   */
  async getJob(id: string): Promise<Job | null> {
    return this.jobs.get(id) || null;
  }
  
  /**
   * Get jobs by status
   */
  async getJobs(status: JobStatus, limit = 10, offset = 0): Promise<Job[]> {
    const jobIds = Array.from(this.jobsByStatus.get(status) || []);
    
    return jobIds
      .slice(offset, offset + limit)
      .map(id => this.jobs.get(id))
      .filter(job => job !== undefined) as Job[];
  }
  
  /**
   * Remove a job from the queue
   */
  async removeJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    
    if (job) {
      // Remove from all tracking collections
      this.jobs.delete(id);
      this.removeFromStatusSet(id, job.status);
      this.removeFromNameSet(job.name, id);
      
      this.logger.debug(`Removed job ${id} from queue`);
    }
  }
  
  /**
   * Pause the queue processing
   */
  async pause(): Promise<void> {
    this.paused = true;
    this.metrics.isPaused = true;
    this.logger.log('Queue processing paused');
  }
  
  /**
   * Resume the queue processing
   */
  async resume(): Promise<void> {
    this.paused = false;
    this.metrics.isPaused = false;
    this.logger.log('Queue processing resumed');
  }
  
  /**
   * Clear all jobs from the queue
   */
  async clear(): Promise<void> {
    this.jobs.clear();
    
    // Reset all status sets
    Object.values(JobStatus).forEach(status => {
      this.jobsByStatus.set(status, new Set<string>());
    });
    
    // Reset name sets
    this.jobsByName.clear();
    
    // Reset metrics
    Object.values(JobStatus).forEach(status => {
      this.metrics.counts[status] = 0;
    });
    
    this.logger.log('Queue cleared');
  }
  
  /**
   * Get the count of jobs by status
   */
  async count(status?: JobStatus): Promise<number> {
    if (status) {
      return this.jobsByStatus.get(status)?.size || 0;
    }
    
    return this.jobs.size;
  }
  
  /**
   * Get queue metrics
   */
  async getMetrics(): Promise<QueueMetrics> {
    return { ...this.metrics };
  }
  
  /**
   * Observable for completed jobs
   */
  onCompleted(): Observable<Job> {
    return this.completedSubject.asObservable();
  }
  
  /**
   * Observable for failed jobs
   */
  onFailed(): Observable<Job> {
    return this.failedSubject.asObservable();
  }
  
  /**
   * Observable for job progress
   */
  onProgress(): Observable<JobProgress> {
    return this.progressSubject.asObservable();
  }
  
  /**
   * Report progress for a job
   */
  reportProgress(jobId: string, progress: number, data?: any): void {
    const job = this.jobs.get(jobId);
    
    if (job) {
      this.progressSubject.next({
        job,
        progress,
        data,
      });
    }
  }
  
  /**
   * Calculate and update queue metrics
   */
  private calculateMetrics(): void {
    // Update counts
    Object.values(JobStatus).forEach(status => {
      this.metrics.counts[status] = this.jobsByStatus.get(status)?.size || 0;
    });
    
    // Calculate average processing time
    if (this.processingTimes.length > 0) {
      const sum = this.processingTimes.reduce((a, b) => a + b, 0);
      this.metrics.averageProcessingTime = sum / this.processingTimes.length;
      
      // Keep only the last 100 processing times
      if (this.processingTimes.length > 100) {
        this.processingTimes = this.processingTimes.slice(-100);
      }
    }
    
    // Calculate throughput (jobs per second)
    const completedCount = this.metrics.counts[JobStatus.COMPLETED];
    const throughput = (completedCount - this.lastProcessedJobs) / 5; // 5 seconds interval
    this.metrics.throughput = throughput >= 0 ? throughput : 0;
    this.lastProcessedJobs = completedCount;
    
    // Calculate error rate
    const failedCount = this.metrics.counts[JobStatus.FAILED];
    const totalProcessed = completedCount + failedCount;
    
    if (totalProcessed > 0) {
      this.metrics.errorRate = (failedCount / totalProcessed) * 100;
    }
    
    // Calculate latency (average time in pending state)
    // This would require tracking when jobs enter and leave the pending state
    // For now, we'll use a placeholder implementation
    this.metrics.latency = this.metrics.averageProcessingTime;
  }
  
  /**
   * Add a job ID to a status set
   */
  private addToStatusSet(jobId: string, status: JobStatus): void {
    const set = this.jobsByStatus.get(status);
    if (set) {
      set.add(jobId);
    }
  }
  
  /**
   * Remove a job ID from a status set
   */
  private removeFromStatusSet(jobId: string, status: JobStatus): void {
    const set = this.jobsByStatus.get(status);
    if (set) {
      set.delete(jobId);
    }
  }
  
  /**
   * Add a job ID to a name set
   */
  private addToNameSet(name: string, jobId: string): void {
    if (!this.jobsByName.has(name)) {
      this.jobsByName.set(name, new Set<string>());
    }
    
    const set = this.jobsByName.get(name);
    if (set) {
      set.add(jobId);
    }
  }
  
  /**
   * Remove a job ID from a name set
   */
  private removeFromNameSet(name: string, jobId: string): void {
    const set = this.jobsByName.get(name);
    if (set) {
      set.delete(jobId);
      
      if (set.size === 0) {
        this.jobsByName.delete(name);
      }
    }
  }
  
  /**
   * Clean up resources when service is destroyed
   */
  onModuleDestroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }
}