import {
  calculateBackoffDelay,
  isRetryableError,
  isRetryableStatusCode,
  shouldRetry,
} from './webhook-backoff.util';
import { DEFAULT_WEBHOOK_RETRY_CONFIG, WebhookRetryConfig } from './webhook-retry.config';

const config: WebhookRetryConfig = {
  ...DEFAULT_WEBHOOK_RETRY_CONFIG,
  maxRetries: 5,
  initialDelayMs: 1_000,
  backoffMultiplier: 2,
  maxDelayMs: 60_000,
  jitter: false,
};

describe('calculateBackoffDelay', () => {
  it('grows exponentially without jitter', () => {
    expect(calculateBackoffDelay(1, config)).toBe(1_000);
    expect(calculateBackoffDelay(2, config)).toBe(2_000);
    expect(calculateBackoffDelay(3, config)).toBe(4_000);
    expect(calculateBackoffDelay(4, config)).toBe(8_000);
  });

  it('caps the delay at maxDelayMs', () => {
    expect(calculateBackoffDelay(20, config)).toBe(60_000);
  });

  it('applies equal jitter within [50%, 100%] of the capped delay', () => {
    const jittered: WebhookRetryConfig = { ...config, jitter: true };
    // attempt 3 → base 4000; equal jitter keeps half fixed + half random.
    expect(calculateBackoffDelay(3, jittered, () => 0)).toBe(2_000); // min
    expect(calculateBackoffDelay(3, jittered, () => 1)).toBe(4_000); // max
    expect(calculateBackoffDelay(3, jittered, () => 0.5)).toBe(3_000); // mid
  });

  it('treats attempts below 1 as the first retry', () => {
    expect(calculateBackoffDelay(0, config)).toBe(1_000);
  });
});

describe('shouldRetry', () => {
  it('retries while attempts are below the max', () => {
    expect(shouldRetry(0, config)).toBe(true);
    expect(shouldRetry(4, config)).toBe(true);
  });

  it('stops once the max retry count is reached', () => {
    expect(shouldRetry(5, config)).toBe(false);
    expect(shouldRetry(6, config)).toBe(false);
  });
});

describe('isRetryableStatusCode', () => {
  it('retries 5xx, 408, 425 and 429', () => {
    [500, 502, 503, 504, 408, 425, 429].forEach((code) =>
      expect(isRetryableStatusCode(code)).toBe(true),
    );
  });

  it('does not retry other 4xx client errors', () => {
    [400, 401, 403, 404, 409, 422].forEach((code) =>
      expect(isRetryableStatusCode(code)).toBe(false),
    );
  });
});

describe('isRetryableError', () => {
  it('retries server responses but not client responses', () => {
    expect(isRetryableError({ response: { status: 503 } })).toBe(true);
    expect(isRetryableError({ response: { status: 400 } })).toBe(false);
  });

  it('retries transport-level errors', () => {
    expect(isRetryableError({ code: 'ECONNRESET' })).toBe(true);
    expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isRetryableError({ code: 'ECONNABORTED', message: 'timeout of 10000ms exceeded' })).toBe(
      true,
    );
  });

  it('returns false for non-error values', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError('boom')).toBe(false);
    expect(isRetryableError({ response: { status: 404 } })).toBe(false);
  });
});
