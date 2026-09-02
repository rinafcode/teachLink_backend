import {
  configureSampling,
  resetSampler,
  getSamplerState,
  buildLogObject,
  initStructuredLogging,
} from './structured-logging';

// Test formatWithSampling by creating a simple wrapper that mimics the console override
function invokeErrorSampling(args: unknown[]): string | null {
  const output: string | null = null;
  const originalConfig = { firstN: 3, thenEveryM: 5 };

  // We'll use configureSampling + manual sampler to test the behaviour
  configureSampling({ firstN: 3, thenEveryM: 5 });

  // We can test by calling initStructuredLogging with a custom output,
  // but instead let's directly test via console.error after init.

  return output;
}

describe('Error sampling / rate limiting', () => {
  let errorOutputs: string[];

  beforeAll(() => {
    // Store original console.error
    const origError = console.error.bind(console);
    errorOutputs = [];

    // Replace console.error with a collector
    console.error = function (...args: unknown[]) {
      errorOutputs.push(args.map(String).join(' '));
      origError(...args);
    } as typeof console.error;

    initStructuredLogging('test');
  });

  afterAll(() => {
    // Don't restore — the test suite owns the override
  });

  beforeEach(() => {
    resetSampler();
    configureSampling({ firstN: 3, thenEveryM: 5 });
    errorOutputs.length = 0;
  });

  function parsedCalls(): Record<string, unknown>[] {
    return errorOutputs.map((s) => JSON.parse(s));
  }

  it('logs every error up to firstN without sampling marker', () => {
    for (let i = 0; i < 3; i++) {
      console.error('db connection failed', { db: 'pg' });
    }

    const outputs = parsedCalls();
    expect(outputs).toHaveLength(3);
    outputs.forEach((out, idx) => {
      expect(out.message).toBe('db connection failed');
      expect(out.occurrenceCount).toBe(idx + 1);
      expect(out.sampled).toBeUndefined();
    });
  });

  it('samples after firstN, logging 1-in-M with occurrenceCount', () => {
    for (let i = 0; i < 13; i++) {
      console.error('timeout');
    }

    const outputs = parsedCalls();
    expect(outputs).toHaveLength(5);

    expect(outputs[0].occurrenceCount).toBe(1);
    expect(outputs[0].sampled).toBeUndefined();
    expect(outputs[1].occurrenceCount).toBe(2);
    expect(outputs[1].sampled).toBeUndefined();
    expect(outputs[2].occurrenceCount).toBe(3);
    expect(outputs[2].sampled).toBeUndefined();
    expect(outputs[3].occurrenceCount).toBe(8);
    expect(outputs[3].sampled).toBe(true);
    expect(outputs[4].occurrenceCount).toBe(13);
    expect(outputs[4].sampled).toBe(true);
  });

  it('tracks different message keys independently', () => {
    for (let i = 0; i < 6; i++) {
      console.error('error-a');
      console.error('error-b');
    }

    const outputs = parsedCalls();
    const aCalls = outputs.filter((o) => o.message === 'error-a');
    const bCalls = outputs.filter((o) => o.message === 'error-b');
    expect(aCalls).toHaveLength(3);
    expect(bCalls).toHaveLength(3);
    expect(outputs).toHaveLength(6);
  });

  it('uses Error.message as sampler key when an Error is passed', () => {
    for (let i = 0; i < 6; i++) {
      console.error(new Error('err occurred'));
    }

    const outputs = parsedCalls();
    expect(outputs).toHaveLength(3);
    outputs.forEach((o, idx) => {
      expect(o.data).toEqual({ message: 'err occurred', stack: expect.any(String) });
      expect(o.occurrenceCount).toBe(idx + 1);
    });
  });

  it('does not sample non-error levels', () => {
    for (let i = 0; i < 10; i++) {
      console.info('info msg');
      console.warn('warn msg');
      console.debug('debug msg');
    }

    expect(getSamplerState().size).toBe(0);
  });

  it('configureSampling updates thresholds', () => {
    configureSampling({ firstN: 1, thenEveryM: 2 });

    for (let i = 0; i < 7; i++) {
      console.error('err');
    }

    const outputs = parsedCalls();
    expect(outputs).toHaveLength(4);
    expect(outputs[0].occurrenceCount).toBe(1);
    expect(outputs[0].sampled).toBeUndefined();
    expect(outputs[1].occurrenceCount).toBe(3);
    expect(outputs[1].sampled).toBe(true);
    expect(outputs[2].occurrenceCount).toBe(5);
    expect(outputs[2].sampled).toBe(true);
    expect(outputs[3].occurrenceCount).toBe(7);
    expect(outputs[3].sampled).toBe(true);
  });

  it('resetSampler clears all state', () => {
    for (let i = 0; i < 6; i++) console.error('err');
    expect(parsedCalls()).toHaveLength(3);

    resetSampler();
    errorOutputs.length = 0;

    for (let i = 0; i < 6; i++) console.error('err');
    expect(parsedCalls()).toHaveLength(3);
  });

  it('getSamplerState returns current counts', () => {
    for (let i = 0; i < 10; i++) console.error('err-a');
    for (let i = 0; i < 5; i++) console.error('err-b');

    const state = getSamplerState();
    expect(state.get('err-a')!.count).toBe(10);
    expect(state.get('err-b')!.count).toBe(5);
  });

  it('buildLogObject is unaffected by sampling', () => {
    const obj = buildLogObject('error', 'test message', { key: 'val' });
    expect(obj.level).toBe('error');
    expect(obj.message).toBe('test message');
    expect(obj.meta).toEqual({ key: 'val' });
  });
});
