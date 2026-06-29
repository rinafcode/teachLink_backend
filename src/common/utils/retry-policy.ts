import { Counter } from 'prom-client';

/**
 * Tracks retry attempts for external service calls, labelled by service name
 * and attempt number, so retry pressure per integration is visible in
 * Grafana/Prometheus.
 */
export const externalCallRetryCounter = new Counter({
  name: 'external_call_retry_total',
  help: 'Total number of retry attempts made for external service calls',
  labelNames: ['service', 'attempt'] as const,
});

export interface RetryPolicyOptions {
  /** Label used on the Prometheus counter, e.g. "email", "payment", "cdn". */
  service: string;
  maxRetries?: number;
  baseDelayMs?: number;
  multiplier?: number;
  maxDelayMs?: number;
  /** Returns true if the error is transient and should be retried. */
  isRetryable?: (error: unknown) => boolean;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MULTIPLIER = 2;
const DEFAULT_MAX_DELAY_MS = 30000;

/**
 * Client errors (4xx) indicate a problem with the request itself, not a
 * transient blip, so they are never retried. Everything else (5xx, network
 * errors with no status code) is treated as transient.
 */
export function isTransientError(error: unknown): boolean {
  const status =
    (error as { status?: number; statusCode?: number; response?: { status?: number } })?.status ??
    (error as { statusCode?: number })?.statusCode ??
    (error as { response?: { status?: number } })?.response?.status;

  if (typeof status === 'number') {
    return status >= 500;
  }

  // No HTTP status (e.g. ECONNRESET, ETIMEDOUT) — assume transient.
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Full-jitter exponential backoff: a random delay between 0 and the
 * capped exponential value for this attempt.
 */
function computeDelayMs(
  attempt: number,
  baseDelayMs: number,
  multiplier: number,
  maxDelayMs: number,
): number {
  const exponential = baseDelayMs * multiplier ** attempt;
  const capped = Math.min(exponential, maxDelayMs);
  return Math.random() * capped;
}

/**
 * Retries a transient-failing async operation with exponential backoff and
 * full jitter. Client errors (4xx) are propagated immediately without retry.
 */
export class RetryPolicy {
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly multiplier: number;
  private readonly maxDelayMs: number;
  private readonly isRetryable: (error: unknown) => boolean;
  private readonly service: string;

  constructor(options: RetryPolicyOptions) {
    this.service = options.service;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.multiplier = options.multiplier ?? DEFAULT_MULTIPLIER;
    this.maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.isRetryable = options.isRetryable ?? isTransientError;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (!this.isRetryable(error) || attempt === this.maxRetries) {
          throw error;
        }

        externalCallRetryCounter.inc({ service: this.service, attempt: String(attempt + 1) });

        const delay = computeDelayMs(attempt, this.baseDelayMs, this.multiplier, this.maxDelayMs);
        await sleep(delay);
      }
    }

    throw lastError;
  }
}
