import { Injectable, Logger } from '@nestjs/common';
import { IRetryStrategy } from '../interfaces/queue.interfaces';
import { RETRY_STRATEGIES } from '../queues.constants';

/**
 * Retry Logic Service
 * Implements intelligent retry strategies for failed jobs
 */
@Injectable()
export class RetryLogicService {
  private readonly logger = new Logger(RetryLogicService.name);

  /**
   * Calculate backoff delay for retry attempts
   */
  calculateBackoffDelay(attemptNumber: number, strategy: IRetryStrategy): number {
    if (strategy.backoffType === 'fixed') {
      return strategy.initialDelay;
    }

    // Exponential backoff: delay = initialDelay * (multiplier ^ attemptNumber)
    const multiplier = strategy.multiplier || 2;
    let delay = strategy.initialDelay * Math.pow(multiplier, attemptNumber - 1);

    // Cap at maxDelay if specified
    if (strategy.maxDelay) {
      delay = Math.min(delay, strategy.maxDelay);
    }

    this.logger.log(`Calculated backoff delay for attempt ${attemptNumber}: ${delay}ms`);

    return delay;
  }

  /**
   * Determine if job should be retried based on error type
   */
  shouldRetry(error: Error, attemptNumber: number, maxAttempts: number): boolean {
    // Don't retry if max attempts reached
    if (attemptNumber >= maxAttempts) {
      this.logger.warn(`Max retry attempts (${maxAttempts}) reached, not retrying`);
      return false;
    }

    // Don't retry for certain error types
    const nonRetryableErrors = [
      'ValidationError',
      'AuthenticationError',
      'AuthorizationError',
      'BadRequestError',
    ];

    if (nonRetryableErrors.some((type) => error.name.includes(type))) {
      this.logger.warn(`Non-retryable error type: ${error.name}, not retrying`);
      return false;
    }

    // Retry for network, timeout, and temporary errors
    const retryableErrors = [
      'NetworkError',
      'TimeoutError',
      'ServiceUnavailableError',
      'TemporaryError',
      'ECONNREFUSED',
      'ETIMEDOUT',
    ];

    const isRetryable = retryableErrors.some(
      (type) => error.name.includes(type) || error.message.includes(type),
    );

    if (isRetryable) {
      this.logger.log(
        `Retryable error detected: ${error.name}, will retry (attempt ${attemptNumber}/${maxAttempts})`,
      );
    }

    return isRetryable;
  }

  /**
   * Get default retry strategy based on job type
   */
  getDefaultStrategy(jobType: string): IRetryStrategy {
    const strategy = RETRY_STRATEGIES[jobType.toLowerCase() as keyof typeof RETRY_STRATEGIES] || RETRY_STRATEGIES.DEFAULT;
    return this.mapRetryStrategy(strategy);
  }

  private mapRetryStrategy(strategy: typeof RETRY_STRATEGIES[keyof typeof RETRY_STRATEGIES]): IRetryStrategy {
    return {
      maxAttempts: strategy.maxAttempts,
      backoffType: strategy.backoffType,
      initialDelay: strategy.initialDelayMs,
      maxDelay: 'maxDelayMs' in strategy ? strategy.maxDelayMs : undefined,
      multiplier: 'multiplier' in strategy ? strategy.multiplier : undefined,
    };
  }

  /**
   * Calculate jitter to prevent thundering herd
   */
  addJitter(delay: number, jitterPercent: number = 0.1): number {
    const jitter = delay * jitterPercent;
    const randomJitter = Math.random() * jitter * 2 - jitter;
    return Math.max(0, Math.floor(delay + randomJitter));
  }

  /**
   * Get retry options for Bull queue
   */
  getRetryOptions(strategy: IRetryStrategy, attemptNumber: number = 1) {
    const baseDelay = this.calculateBackoffDelay(attemptNumber, strategy);
    const delayWithJitter = this.addJitter(baseDelay);

    return {
      attempts: strategy.maxAttempts,
      backoff: {
        type: strategy.backoffType,
        delay: delayWithJitter,
      },
    };
  }

  /**
   * Log retry attempt
   */
  logRetryAttempt(
    jobId: string,
    jobName: string,
    attemptNumber: number,
    error: Error,
    nextRetryDelay: number,
  ): void {
    this.logger.warn(
      `Job ${jobName} (${jobId}) failed on attempt ${attemptNumber}. ` +
        `Error: ${error.message}. ` +
        `Next retry in ${nextRetryDelay}ms`,
    );
  }

  /**
   * Handle final failure after all retries exhausted
   */
  handleFinalFailure(jobId: string, jobName: string, error: Error, attempts: number): void {
    this.logger.error(
      `Job ${jobName} (${jobId}) permanently failed after ${attempts} attempts. ` +
        `Final error: ${error.message}`,
    );

    // Here you could:
    // - Send alert to monitoring system
    // - Store in dead letter queue
    // - Notify administrators
    // - Log to external service
  }
}
