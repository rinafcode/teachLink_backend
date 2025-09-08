import { Injectable, Logger } from '@nestjs/common';
import { Job, JobStatus, RetryStrategy, BackoffStrategy } from '../interfaces/job.interface';
import { QueueService } from '../queue.service';

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  defaultMaxAttempts: number;
  defaultBackoffStrategy: BackoffStrategy;
  defaultInitialBackoff: number; // in milliseconds
  maxBackoff: number; // in milliseconds
  retryOnSpecificErrors?: string[]; // Error types to retry on
  noRetryOnSpecificErrors?: string[]; // Error types to not retry on
}

/**
 * Service for handling job retry logic
 */
@Injectable()
export class RetryLogicService {
  private readonly logger = new Logger(RetryLogicService.name);
  private config: RetryConfig = {
    defaultMaxAttempts: 3,
    defaultBackoffStrategy: {
      type: RetryStrategy.EXPONENTIAL,
      factor: 2,
      randomizationFactor: 0.5
    },
    defaultInitialBackoff: 1000, // 1 second
    maxBackoff: 3600000, // 1 hour
  };

  constructor(private readonly queueService: QueueService) {
    // Subscribe to job failure events
    this.queueService.onFailed().subscribe(job => {
      this.handleFailedJob(job);
    });
  }

  /**
   * Set retry configuration
   */
  setConfig(config: Partial<RetryConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    
    this.logger.log('Retry configuration updated');
  }

  /**
   * Get current retry configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Handle a failed job
   */
  async handleFailedJob(job: Job): Promise<void> {
    // Check if we should retry
    if (!this.shouldRetry(job)) {
      this.logger.warn(`Job ${job.id} (${job.name}) will not be retried after ${job.attempts} attempts. Last error: ${job.lastError}`);
      return;
    }

    // Calculate next retry delay
    const retryDelay = this.calculateRetryDelay(job);
    
    // Schedule the retry
    const scheduledTime = new Date(Date.now() + retryDelay);
    
    this.logger.log(`Scheduling retry #${job.attempts + 1} for job ${job.id} (${job.name}) at ${scheduledTime.toISOString()} (delay: ${retryDelay}ms)`);
    
    // Update job status to pending and schedule it
    job.status = JobStatus.PENDING;
    job.scheduledFor = scheduledTime;
    
    // Add retry attempt information
    job.attempts += 1;
    
    // Save the updated job
    await this.queueService.updateJob(job);
  }

  /**
   * Determine if a job should be retried
   */
  shouldRetry(job: Job): boolean {
    // Check max attempts
    const maxAttempts = job.maxAttempts || this.config.defaultMaxAttempts;
    if (job.attempts >= maxAttempts) {
      return false;
    }

    // Check for specific error types to not retry on
    if (job.lastError && this.config.noRetryOnSpecificErrors?.length) {
      for (const errorType of this.config.noRetryOnSpecificErrors) {
        if (job.lastError.includes(errorType)) {
          return false;
        }
      }
    }

    // Check for specific error types to retry on
    if (job.lastError && this.config.retryOnSpecificErrors?.length) {
      let shouldRetryForError = false;
      for (const errorType of this.config.retryOnSpecificErrors) {
        if (job.lastError.includes(errorType)) {
          shouldRetryForError = true;
          break;
        }
      }
      
      // If we have a list of errors to retry on and none matched, don't retry
      if (!shouldRetryForError) {
        return false;
      }
    }

    // Check if job has custom retry options
    if (job.options?.noRetry) {
      return false;
    }

    return true;
  }

  /**
   * Calculate delay before next retry attempt
   */
  calculateRetryDelay(job: Job): number {
    // Get backoff strategy
    const backoffStrategy = job.options?.retryStrategy || this.config.defaultBackoffStrategy;
    const initialBackoff = job.options?.initialBackoff || this.config.defaultInitialBackoff;
    
    let delay: number;
    
    switch (backoffStrategy.type) {
      case RetryStrategy.FIXED:
        delay = initialBackoff;
        break;
        
      case RetryStrategy.LINEAR:
        delay = initialBackoff * (job.attempts + 1);
        break;
        
      case RetryStrategy.EXPONENTIAL:
        const factor = backoffStrategy.factor || 2;
        delay = initialBackoff * Math.pow(factor, job.attempts);
        break;
        
      case RetryStrategy.FIBONACCI:
        delay = this.calculateFibonacciBackoff(initialBackoff, job.attempts);
        break;
        
      default:
        // Default to exponential
        delay = initialBackoff * Math.pow(2, job.attempts);
    }
    
    // Apply randomization if configured
    if (backoffStrategy.randomizationFactor) {
      const randomFactor = 1 - backoffStrategy.randomizationFactor + 
                          (Math.random() * backoffStrategy.randomizationFactor * 2);
      delay = Math.floor(delay * randomFactor);
    }
    
    // Ensure we don't exceed max backoff
    return Math.min(delay, this.config.maxBackoff);
  }
  
  /**
   * Calculate Fibonacci backoff sequence
   */
  private calculateFibonacciBackoff(initialBackoff: number, attempt: number): number {
    // Calculate the Fibonacci number for this attempt
    let a = 0;
    let b = 1;
    let fib = 1;
    
    for (let i = 2; i <= attempt + 1; i++) {
      fib = a + b;
      a = b;
      b = fib;
    }
    
    return initialBackoff * fib;
  }
  
  /**
   * Analyze retry patterns to detect problematic jobs
   */
  async analyzeRetryPatterns(): Promise<Record<string, any>> {
    // Get all jobs with attempts > 0
    const retriedJobs = await this.queueService.getJobsByFilter({
      minAttempts: 1,
      limit: 1000,
    });
    
    // Group by job name
    const jobTypeStats: Record<string, {
      totalJobs: number;
      totalRetries: number;
      avgRetries: number;
      maxRetries: number;
      successRate: number;
      commonErrors: Record<string, number>;
    }> = {};
    
    // Process each job
    for (const job of retriedJobs) {
      if (!jobTypeStats[job.name]) {
        jobTypeStats[job.name] = {
          totalJobs: 0,
          totalRetries: 0,
          avgRetries: 0,
          maxRetries: 0,
          successRate: 0,
          commonErrors: {},
        };
      }
      
      const stats = jobTypeStats[job.name];
      stats.totalJobs++;
      stats.totalRetries += job.attempts;
      stats.maxRetries = Math.max(stats.maxRetries, job.attempts);
      
      // Track error types
      if (job.lastError) {
        // Extract error type (simplified)
        const errorType = job.lastError.split(':')[0] || 'Unknown';
        stats.commonErrors[errorType] = (stats.commonErrors[errorType] || 0) + 1;
      }
      
      // Track success rate
      if (job.status === JobStatus.COMPLETED) {
        stats.successRate += 1;
      }
    }
    
    // Calculate averages and percentages
    for (const jobType in jobTypeStats) {
      const stats = jobTypeStats[jobType];
      stats.avgRetries = stats.totalRetries / stats.totalJobs;
      stats.successRate = (stats.successRate / stats.totalJobs) * 100;
    }
    
    return jobTypeStats;
  }
  
  /**
   * Get recommendations for retry strategy optimization
   */
  async getRetryRecommendations(): Promise<Record<string, string>> {
    const patterns = await this.analyzeRetryPatterns();
    const recommendations: Record<string, string> = {};
    
    for (const jobType in patterns) {
      const stats = patterns[jobType];
      
      // High retry count but low success rate
      if (stats.avgRetries > 2 && stats.successRate < 30) {
        recommendations[jobType] = 'Consider reducing max attempts or investigating persistent failures';
      }
      
      // High retry count but high success rate
      if (stats.avgRetries > 2 && stats.successRate > 70) {
        recommendations[jobType] = 'Retries are effective but consider addressing root cause of initial failures';
      }
      
      // Low retry count and high success rate
      if (stats.avgRetries <= 1 && stats.successRate > 90) {
        recommendations[jobType] = 'Current retry strategy is effective';
      }
      
      // Specific error patterns
      const errorEntries = Object.entries(stats.commonErrors);
      if (errorEntries.length > 0) {
        const [mostCommonError] = errorEntries.sort((a, b) => b[1] - a[1])[0];
        recommendations[`${jobType}_errors`] = `Most common error: ${mostCommonError}. Consider specific handling for this error type.`;
      }
    }
    
    return recommendations;
  }
}