import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSharedRedisClient } from '../../config/cache.config';
import { BaseWorker } from './base.worker';
import { getCorrelationId, runWithCorrelationId } from '../../common/utils/correlation.utils';
import {
  CORRELATION_JOB_FIELD,
  enrichWithCorrelation,
  extractCorrelationIdFromJob,
} from '../../queues/utils/correlation-job.util';

jest.mock('../../config/cache.config', () => ({
  getSharedRedisClient: jest.fn(),
}));

// Spy on Logger so we can assert structured error output
const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

class TestWorker extends BaseWorker {
  public lastSeenCorrelationId: string | undefined;
  public jobDataCapture: unknown;
  public shouldFail = false;

  constructor() {
    super('test-worker', { get: jest.fn().mockReturnValue(300) } as unknown as ConfigService);
  }

  async execute(job: { id: number | string; name: string; data: Record<string, unknown> }) {
    // Capture during execute() to verify ALS propagation works across awaits.
    this.lastSeenCorrelationId = getCorrelationId();
    this.jobDataCapture = job.data;
    if (this.shouldFail) {
      throw new Error('Simulated failure');
    }
    return { ok: true };
  }
}

const buildJob = (data: Record<string, unknown>) =>
  ({
    id: 'job-1',
    name: 'demo-task',
    data,
    attemptsMade: 2,
    progress: jest.fn().mockResolvedValue(undefined),
  }) as any;

describe('BaseWorker', () => {
  let redisSet: jest.Mock;

  beforeEach(() => {
    redisSet = jest.fn().mockResolvedValue('OK');
    (getSharedRedisClient as jest.Mock).mockReturnValue({
      set: redisSet,
    });
    loggerErrorSpy.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('restores the originating correlation ID stamped on the job payload', async () => {
    const worker = new TestWorker();
    const enriched = enrichWithCorrelation({ userId: 'u-1' });

    const result = await worker.handle(buildJob(enriched as any));

    expect(result.success).toBe(true);
    expect(worker.lastSeenCorrelationId).toBe((enriched as any)[CORRELATION_JOB_FIELD]);
    expect((worker.jobDataCapture as any)[CORRELATION_JOB_FIELD]).toBe(
      (enriched as any)[CORRELATION_JOB_FIELD],
    );
  });

  it('generates a fresh correlation ID when the payload has none (cron / background enqueue)', async () => {
    const worker = new TestWorker();
    let observedInExecute: string | undefined;

    const probeWorker = new (class extends BaseWorker {
      constructor() {
        super('probe-worker', { get: jest.fn().mockReturnValue(300) } as unknown as ConfigService);
      }
      async execute() {
        observedInExecute = getCorrelationId();
        return { ok: true };
      }
    })();

    await probeWorker.handle(buildJob({ userId: 'u-2' }) as any);

    expect(observedInExecute).toBeDefined();
    expect(observedInExecute).toMatch(/^cid-/);
  });

  it('extractCorrelationIdFromJob returns undefined when the payload has no correlation ID', () => {
    expect(extractCorrelationIdFromJob(buildJob({ foo: 'bar' }))).toBeUndefined();
  });

  it('extractCorrelationIdFromJob returns undefined for malformed payloads', () => {
    expect(extractCorrelationIdFromJob({ data: undefined as any })).toBeUndefined();
    expect(extractCorrelationIdFromJob(buildJob({ foo: 'bar' }))).toBeUndefined();
  });

  it('does not leak the worker-scoped correlation ID out of runHandle', async () => {
    const worker = new TestWorker();
    const enriched = enrichWithCorrelation({ userId: 'u-3' });
    await worker.handle(buildJob(enriched as any));

    // After handle() resolved the AsyncLocalStorage scope unwinds, so getCorrelationId()
    // outside should not match the in-worker value.
    const outside = getCorrelationId();
    expect(outside).not.toBe(worker.lastSeenCorrelationId);
  });

  it('runWithCorrelationId nests correctly when invoked twice', async () => {
    const inner = await runWithCorrelationId(() => getCorrelationId(), 'inner-id');
    expect(inner).toBe('inner-id');
    const outer = await runWithCorrelationId(() => getCorrelationId(), 'outer-id');
    expect(outer).toBe('outer-id');
  });

  describe('structured failure logging', () => {
    it('emits a structured JSON log with correlation id and job metadata on failure', async () => {
      const worker = new TestWorker();
      worker.shouldFail = true;
      const enriched = enrichWithCorrelation({ userId: 'u-fail' });

      await expect(worker.handle(buildJob(enriched as any))).rejects.toThrow('Simulated failure');

      expect(loggerErrorSpy).toHaveBeenCalled();
      const logCall = loggerErrorSpy.mock.calls[loggerErrorSpy.mock.calls.length - 1];
      const logArg = logCall[0] as string;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(logArg);
      } catch {
        throw new Error(`Expected structured JSON log, got: ${logArg}`);
      }

      expect(parsed.event).toBe('job_failed');
      expect(parsed.jobName).toBe('demo-task');
      expect(parsed.jobId).toBe('job-1');
      expect(parsed.attempt).toBe(3); // attemptsMade (2) + 1
      expect(parsed.correlationId).toBe((enriched as any)[CORRELATION_JOB_FIELD]);
      expect(parsed.error).toBe('Simulated failure');
      expect(parsed.workerId).toBe(worker.getId());
      expect(parsed.workerType).toBe(worker.getType());
      expect(parsed.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('logs "unknown" correlation id when job has no correlation data', async () => {
      const worker = new TestWorker();
      worker.shouldFail = true;

      await expect(worker.handle(buildJob({ unrelated: true }) as any)).rejects.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalled();
      const logCall = loggerErrorSpy.mock.calls[loggerErrorSpy.mock.calls.length - 1];
      const parsed = JSON.parse(logCall[0] as string) as Record<string, unknown>;
      expect(parsed.correlationId).toBe('unknown');
    });
  });
});
