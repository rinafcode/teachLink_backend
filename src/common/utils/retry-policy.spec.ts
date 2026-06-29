import { RetryPolicy, isTransientError, externalCallRetryCounter } from './retry-policy';

describe('RetryPolicy', () => {
  beforeEach(() => {
    externalCallRetryCounter.reset();
  });

  it('returns the result immediately on success without retrying', async () => {
    const policy = new RetryPolicy({ service: 'test', baseDelayMs: 1, maxDelayMs: 1 });
    const fn = jest.fn().mockResolvedValue('ok');

    const result = await policy.execute(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on a transient failure and eventually succeeds', async () => {
    const policy = new RetryPolicy({ service: 'email', baseDelayMs: 1, maxDelayMs: 1 });
    const transientError = { status: 503 };
    const fn = jest
      .fn()
      .mockRejectedValueOnce(transientError)
      .mockRejectedValueOnce(transientError)
      .mockResolvedValue('ok');

    const result = await policy.execute(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('propagates the error after exhausting retries', async () => {
    const policy = new RetryPolicy({ service: 'payment', maxRetries: 3, baseDelayMs: 1, maxDelayMs: 1 });
    const transientError = { status: 503 };
    const fn = jest.fn().mockRejectedValue(transientError);

    await expect(policy.execute(fn)).rejects.toBe(transientError);
    expect(fn).toHaveBeenCalledTimes(4); // initial attempt + 3 retries
  });

  it('does not retry client errors (4xx)', async () => {
    const policy = new RetryPolicy({ service: 'payment', baseDelayMs: 1, maxDelayMs: 1 });
    const clientError = { status: 400 };
    const fn = jest.fn().mockRejectedValue(clientError);

    await expect(policy.execute(fn)).rejects.toBe(clientError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries network errors with no status code', async () => {
    const policy = new RetryPolicy({ service: 'cdn', baseDelayMs: 1, maxDelayMs: 1 });
    const networkError = new Error('ECONNRESET');
    const fn = jest.fn().mockRejectedValueOnce(networkError).mockResolvedValue('ok');

    const result = await policy.execute(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('increments the external_call_retry_total counter per retry attempt', async () => {
    const policy = new RetryPolicy({ service: 'cdn', baseDelayMs: 1, maxDelayMs: 1 });
    const transientError = { status: 503 };
    const fn = jest.fn().mockRejectedValueOnce(transientError).mockResolvedValue('ok');

    await policy.execute(fn);

    const metric = await externalCallRetryCounter.get();
    const sample = metric.values.find(
      (v) => v.labels.service === 'cdn' && v.labels.attempt === '1',
    );
    expect(sample?.value).toBe(1);
  });
});

describe('isTransientError', () => {
  it('treats 5xx as transient', () => {
    expect(isTransientError({ status: 503 })).toBe(true);
  });

  it('treats 4xx as non-transient', () => {
    expect(isTransientError({ status: 404 })).toBe(false);
  });

  it('treats errors with no status as transient (network errors)', () => {
    expect(isTransientError(new Error('ETIMEDOUT'))).toBe(true);
  });
});
