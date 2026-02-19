import { Injectable, Logger } from '@nestjs/common';
import { RetryStrategy } from '../interfaces/queue.interfaces';

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
  calculateBackoffDelay(
    attemptNumber: number,
    strategy: RetryStrategy,
  ): number {
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

    this.logger.log(
      `Calculated backoff delay for attempt ${attemptNumber}: ${delay}ms`,
    );

    return delay;
  }

  /**
   * Determine if job should be retried based on error type
   */
  shouldRetry(error: Error, attemptNumber: number, maxAttempts: number): boolean {
    // Don't retry if max attempts reached
    if (attemptNumber >= maxAttempts) {
      this.logger.warn(
        `Max retry attempts (${maxAttempts}) reached, not retrying`,
      );
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
      this.logger.warn(
        `Non-retryable error type: ${error.name}, not retrying`,
      );
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
      (type) =>
        error.name.includes(type) || error.message.includes(type),
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
  getDefaultStrategy(jobType: string): RetryStrategy {
    const strategies: Record<string, RetryStrategy> = {
      email: {
        maxAttempts: 5,
        backoffType: 'exponential',
        initialDelay: 2000,
        maxDelay: 60000,
        multiplier: 2,
      },
      payment: {
        maxAttempts: 3,
        backoffType: 'exponential',
        initialDelay: 5000,
        maxDelay: 30000,
        multiplier: 2,
      },
      notification: {
        maxAttempts: 4,
        backoffType: 'exponential',
        initialDelay: 1000,
        maxDelay: 20000,
        multiplier: 2,
      },
      backup: {
        maxAttempts: 3,
        backoffType: 'fixed',
        initialDelay: 10000,
      },
      report: {
        maxAttempts: 2,
        backoffType: 'fixed',
        initialDelay: 5000,
      },
      default: {
        maxAttempts: 3,
        backoffType: 'exponential',
        initialDelay: 3000,
        maxDelay: 30000,
        multiplier: 2,
      },
    };

    return strategies[jobType] || strategies.default;
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
  getRetryOptions(strategy: RetryStrategy, attemptNumber: number = 1) {
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
  handleFinalFailure(
    jobId: string,
    jobName: string,
    error: Error,
    attempts: number,
  ): void {
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
