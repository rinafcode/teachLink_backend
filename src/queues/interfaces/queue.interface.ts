import { Observable } from 'rxjs';
import { Job, JobOptions, JobStatus } from './job.interface';

/**
 * Interface for queue operations
 */
export interface Queue<T = any> {
  /**
   * Add a job to the queue
   * @param name Job name
   * @param data Job data
   * @param options Job options
   */
  add(name: string, data: T, options?: JobOptions): Promise<Job<T>>;

  /**
   * Add a job to be processed at a specific time
   * @param name Job name
   * @param data Job data
   * @param scheduledFor When to process the job
   * @param options Job options
   */
  schedule(name: string, data: T, scheduledFor: Date, options?: JobOptions): Promise<Job<T>>;

  /**
   * Process a job from the queue
   * @param processor Function to process the job
   */
  process<R = any>(processor: (job: Job<T>) => Promise<R>): void;

  /**
   * Get a job by ID
   * @param id Job ID
   */
  getJob(id: string): Promise<Job<T> | null>;

  /**
   * Get jobs by status
   * @param status Job status
   * @param limit Maximum number of jobs to return
   * @param offset Offset for pagination
   */
  getJobs(status: JobStatus, limit?: number, offset?: number): Promise<Job<T>[]>;

  /**
   * Remove a job from the queue
   * @param id Job ID
   */
  removeJob(id: string): Promise<void>;

  /**
   * Pause the queue processing
   */
  pause(): Promise<void>;

  /**
   * Resume the queue processing
   */
  resume(): Promise<void>;

  /**
   * Clear all jobs from the queue
   */
  clear(): Promise<void>;

  /**
   * Get the count of jobs by status
   * @param status Job status
   */
  count(status?: JobStatus): Promise<number>;

  /**
   * Get queue metrics
   */
  getMetrics(): Promise<QueueMetrics>;

  /**
   * Observable for completed jobs
   */
  onCompleted(): Observable<Job<T>>;

  /**
   * Observable for failed jobs
   */
  onFailed(): Observable<Job<T>>;

  /**
   * Observable for job progress
   */
  onProgress(): Observable<JobProgress<T>>;
}

/**
 * Interface for job progress events
 */
export interface JobProgress<T = any> {
  /**
   * The job being processed
   */
  job: Job<T>;

  /**
   * Progress percentage (0-100)
   */
  progress: number;

  /**
   * Additional data about the progress
   */
  data?: any;
}

/**
 * Interface for queue metrics
 */
export interface QueueMetrics {
  /**
   * Name of the queue
   */
  name: string;

  /**
   * Number of jobs by status
   */
  counts: {
    [key in JobStatus]: number;
  };

  /**
   * Average processing time in milliseconds
   */
  averageProcessingTime: number;

  /**
   * Throughput (jobs per second)
   */
  throughput: number;

  /**
   * Error rate (percentage)
   */
  errorRate: number;

  /**
   * Latency (milliseconds)
   */
  latency: number;

  /**
   * Whether the queue is paused
   */
  isPaused: boolean;

  /**
   * Number of workers processing jobs
   */
  workerCount: number;
}