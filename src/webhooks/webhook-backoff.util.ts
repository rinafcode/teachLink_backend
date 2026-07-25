/**
 * Pure helpers for exponential-backoff retry scheduling and retryability
 * classification. Kept dependency-free so they can be unit-tested in isolation
 * and reused by both the delivery service and the Bull worker.
 */
import { WebhookRetryConfig } from './webhook-retry.config';

/**
 * Compute the delay (ms) before a given retry attempt using exponential
 * backoff with an optional "equal jitter" component and a hard cap.
 *
 * @param attempt  1-based retry number (1 = the first retry after the initial try)
 * @param config   retry configuration
 * @param rng      random source in [0, 1); injectable for deterministic tests
 */
export const calculateBackoffDelay = (
  attempt: number,
  config: WebhookRetryConfig,
  rng: () => number = Math.random,
): number => {
  const safeAttempt = Math.max(1, Math.floor(attempt));

  // Exponential growth: initial * multiplier^(attempt-1), capped.
  const exponential = config.initialDelayMs * Math.pow(config.backoffMultiplier, safeAttempt - 1);
  const capped = Math.min(exponential, config.maxDelayMs);

  if (!config.jitter) {
    return Math.round(capped);
  }

  // Equal jitter: keep half the delay fixed and randomise the other half so
  // retries spread out without ever collapsing to near-zero.
  const half = capped / 2;
  return Math.round(half + rng() * half);
};

/**
 * Whether another attempt should be made.
 *
 * @param attemptsMade number of attempts already completed
 * @param config       retry configuration (uses maxRetries as the total cap)
 */
export const shouldRetry = (attemptsMade: number, config: WebhookRetryConfig): boolean =>
  attemptsMade < config.maxRetries;

/**
 * HTTP status codes worth retrying: request timeouts, rate limits, and any
 * server-side (5xx) error. Other 4xx responses are permanent client errors and
 * are NOT retried.
 */
export const isRetryableStatusCode = (statusCode: number): boolean => {
  if (statusCode >= 500) return true;
  return statusCode === 408 || statusCode === 425 || statusCode === 429;
};

const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EPIPE',
  'ECONNABORTED',
]);

/**
 * Classify a thrown delivery error (typically an Axios error) as retryable.
 * A response with a status code defers to {@link isRetryableStatusCode}; a
 * transport-level failure with no response is retryable.
 */
export const isRetryableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  const err = error as {
    response?: { status?: number };
    code?: string;
    message?: string;
  };

  if (err.response && typeof err.response.status === 'number') {
    return isRetryableStatusCode(err.response.status);
  }

  if (err.code && RETRYABLE_ERROR_CODES.has(err.code)) return true;

  // Network/timeout errors that surface only as a message.
  if (err.code === undefined && /timeout|socket hang up|network/i.test(err.message ?? '')) {
    return true;
  }

  // No response and not an obviously permanent error → treat as transient.
  return err.response === undefined && err.code !== undefined;
};
