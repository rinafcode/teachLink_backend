/**
 * Interface for job objects in the queue system
 */
export interface Job<T = any> {
  /**
   * Unique identifier for the job
   */
  id: string;

  /**
   * Name of the job type
   */
  name: string;

  /**
   * Data payload for the job
   */
  data: T;

  /**
   * Priority level of the job (higher number = higher priority)
   */
  priority: number;

  /**
   * When the job was created
   */
  createdAt: Date;

  /**
   * When the job should be processed
   */
  scheduledFor?: Date;

  /**
   * Number of attempts made to process this job
   */
  attempts: number;

  /**
   * Maximum number of retry attempts
   */
  maxAttempts: number;

  /**
   * Last error encountered during processing
   */
  lastError?: Error | string;

  /**
   * When the job was last attempted
   */
  lastAttemptedAt?: Date;

  /**
   * Status of the job
   */
  status: JobStatus;

  /**
   * Options for job processing
   */
  options?: JobOptions;
}

/**
 * Possible job statuses
 */
export enum JobStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  RETRYING = 'retrying'
}

/**
 * Options for job processing
 */
export interface JobOptions {
  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Retry strategy
   */
  retryStrategy?: RetryStrategy;

  /**
   * Whether to remove the job when completed
   */
  removeOnComplete?: boolean;

  /**
   * Whether to remove the job when failed
   */
  removeOnFail?: boolean;

  /**
   * Backoff strategy for retries
   */
  backoff?: BackoffStrategy;
}

/**
 * Retry strategy options
 */
export enum RetryStrategy {
  EXPONENTIAL = 'exponential',
  FIXED = 'fixed',
  LINEAR = 'linear'
}

/**
 * Backoff strategy configuration
 */
export interface BackoffStrategy {
  /**
   * Type of backoff
   */
  type: RetryStrategy;

  /**
   * Delay in milliseconds
   */
  delay: number;
}