import {
  DEFAULT_RETRY_POLICY,
  RetryAttemptContext,
  computeRetryDelayMs,
  extractStatusCode,
  isRetryableStatus,
  isTransientError,
  resolveRetryPolicy,
  retryWithPolicy,
} from './retry-policy';

const withStatus = (status: number): Error => Object.assign(new Error('boom'), { status });
const withCode = (code: string): Error => Object.assign(new Error('boom'), { code });

describe('isRetryableStatus', () => {
  it('retries server errors', () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
  });

  it('does not retry 501, which is a permanent capability gap', () => {
    expect(isRetryableStatus(501)).toBe(false);
  });

  it('does not retry ordinary client errors', () => {
    [400, 401, 403, 404, 409, 422].forEach((status) => {
      expect(isRetryableStatus(status)).toBe(false);
    });
  });

  it('retries the 4xx codes that invite another attempt', () => {
    expect(isRetryableStatus(408)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
  });
});

describe('extractStatusCode', () => {
  it('reads the Axios error shape', () => {
    expect(extractStatusCode({ response: { status: 503 } })).toBe(503);
  });

  it('reads the AWS SDK v3 error shape', () => {
    expect(extractStatusCode({ $metadata: { httpStatusCode: 500 } })).toBe(500);
  });

  it('reads the Nodemailer error shape', () => {
    expect(extractStatusCode({ responseCode: 421 })).toBe(421);
  });

  it('returns undefined for an error carrying no status', () => {
    expect(extractStatusCode(new Error('socket hang up'))).toBeUndefined();
    expect(extractStatusCode(null)).toBeUndefined();
    expect(extractStatusCode('nope')).toBeUndefined();
  });
});

describe('isTransientError', () => {
  it('treats a provider 503 as transient', () => {
    expect(isTransientError(withStatus(503))).toBe(true);
    expect(isTransientError({ response: { status: 503 } })).toBe(true);
  });

  it('treats a client error as permanent', () => {
    expect(isTransientError(withStatus(400))).toBe(false);
    expect(isTransientError(withStatus(404))).toBe(false);
  });

  it('treats known socket codes as transient', () => {
    expect(isTransientError(withCode('ECONNRESET'))).toBe(true);
    expect(isTransientError(withCode('ETIMEDOUT'))).toBe(true);
    expect(isTransientError(withCode('EAI_AGAIN'))).toBe(true);
  });

  it('lets a status override a socket code', () => {
    const error = Object.assign(new Error('boom'), { status: 400, code: 'ECONNRESET' });
    expect(isTransientError(error)).toBe(false);
  });

  it('does not replay programming errors', () => {
    expect(isTransientError(new TypeError('undefined is not a function'))).toBe(false);
    expect(isTransientError(withCode('SOMETHING_ELSE'))).toBe(false);
  });
});

describe('computeRetryDelayMs', () => {
  const noJitter = resolveRetryPolicy({ fullJitter: false });

  it('grows the delay geometrically from the 1s base', () => {
    expect(computeRetryDelayMs(1, noJitter)).toBe(1_000);
    expect(computeRetryDelayMs(2, noJitter)).toBe(2_000);
    expect(computeRetryDelayMs(3, noJitter)).toBe(4_000);
  });

  it('never exceeds the 30s ceiling', () => {
    expect(computeRetryDelayMs(20, noJitter)).toBe(30_000);
  });

  it('spreads full jitter across the whole window', () => {
    expect(computeRetryDelayMs(2, DEFAULT_RETRY_POLICY, () => 0)).toBe(0);
    expect(computeRetryDelayMs(2, DEFAULT_RETRY_POLICY, () => 0.5)).toBe(1_000);
    expect(computeRetryDelayMs(2, DEFAULT_RETRY_POLICY, () => 1)).toBe(2_000);
  });

  it('treats attempts below 1 as the first retry', () => {
    expect(computeRetryDelayMs(0, noJitter)).toBe(1_000);
  });
});

describe('retryWithPolicy', () => {
  let sleeps: number[];
  let sleep: (ms: number) => Promise<void>;

  beforeEach(() => {
    sleeps = [];
    sleep = async (ms: number) => {
      sleeps.push(ms);
    };
  });

  it('returns the first successful result without sleeping', async () => {
    const operation = jest.fn().mockResolvedValue('ok');

    await expect(retryWithPolicy(operation, { sleep })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });

  it('retries a single transient 503 and then succeeds', async () => {
    const operation = jest.fn().mockRejectedValueOnce(withStatus(503)).mockResolvedValue('sent');

    const result = await retryWithPolicy(operation, {
      sleep,
      policy: { fullJitter: false },
    });

    expect(result).toBe('sent');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([1_000]);
  });

  it('propagates the error once the retry budget is spent', async () => {
    const error = withStatus(503);
    const operation = jest.fn().mockRejectedValue(error);

    await expect(retryWithPolicy(operation, { sleep, policy: { fullJitter: false } })).rejects.toBe(
      error,
    );

    // The initial call plus three retries.
    expect(operation).toHaveBeenCalledTimes(4);
    expect(sleeps).toEqual([1_000, 2_000, 4_000]);
  });

  it('fails fast on a client error', async () => {
    const error = withStatus(400);
    const operation = jest.fn().mockRejectedValue(error);

    await expect(retryWithPolicy(operation, { sleep })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });

  it('reports each retry through the onRetry hook', async () => {
    const contexts: RetryAttemptContext[] = [];
    const operation = jest.fn().mockRejectedValueOnce(withStatus(503)).mockResolvedValue('ok');

    await retryWithPolicy(operation, {
      sleep,
      service: 'email',
      policy: { fullJitter: false },
      onRetry: (context) => contexts.push(context),
    });

    expect(contexts).toHaveLength(1);
    expect(contexts[0].attempt).toBe(1);
    expect(contexts[0].delayMs).toBe(1_000);
    expect(contexts[0].service).toBe('email');
  });

  it('passes the 1-based attempt number to the operation', async () => {
    const operation = jest.fn().mockRejectedValueOnce(withStatus(503)).mockResolvedValue('ok');

    await retryWithPolicy(operation, { sleep, policy: { fullJitter: false } });

    expect(operation.mock.calls).toEqual([[1], [2]]);
  });

  it('honours a custom transience predicate', async () => {
    const operation = jest.fn().mockRejectedValueOnce(new Error('flaky')).mockResolvedValue('ok');

    const result = await retryWithPolicy(operation, {
      sleep,
      isTransient: () => true,
      policy: { fullJitter: false },
    });

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('respects a reduced retry budget', async () => {
    const operation = jest.fn().mockRejectedValue(withStatus(500));

    await expect(
      retryWithPolicy(operation, { sleep, policy: { maxRetries: 1, fullJitter: false } }),
    ).rejects.toThrow('boom');

    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([1_000]);
  });
});
