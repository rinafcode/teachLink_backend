import { runWithCorrelationId } from '../../common/utils/correlation.utils';
import {
  CORRELATION_JOB_FIELD,
  enrichWithCorrelation,
  extractCorrelationIdFromJob,
} from './correlation-job.util';

describe('correlation-job utilities', () => {
  describe('enrichWithCorrelation', () => {
    it('uses the active correlation ID from AsyncLocalStorage', () => {
      const id = 'cid-active';
      const enriched = runWithCorrelationId(() => enrichWithCorrelation({ userId: 'u-1' }), id);

      expect(enriched.userId).toBe('u-1');
      expect(enriched[CORRELATION_JOB_FIELD]).toBe(id);
    });

    it('generates a fresh correlation ID when none is active', () => {
      const enriched = enrichWithCorrelation({ userId: 'u-2' });
      expect(typeof enriched[CORRELATION_JOB_FIELD]).toBe('string');
      expect(enriched[CORRELATION_JOB_FIELD]).toMatch(/^cid-/);
    });

    it('does not mutate the source payload', () => {
      const original = { foo: 'bar' };
      const enriched = enrichWithCorrelation(original);
      expect((original as Record<string, unknown>)[CORRELATION_JOB_FIELD]).toBeUndefined();
      expect(enriched.foo).toBe('bar');
    });
  });

  describe('extractCorrelationIdFromJob', () => {
    it('returns the embedded correlation ID', () => {
      const job = { data: { [CORRELATION_JOB_FIELD]: 'cid-xyz', userId: 'u-3' } } as any;
      expect(extractCorrelationIdFromJob(job)).toBe('cid-xyz');
    });

    it('returns undefined for jobs without the field', () => {
      expect(extractCorrelationIdFromJob({ data: { foo: 'bar' } } as any)).toBeUndefined();
    });

    it('returns undefined when job.data is undefined', () => {
      expect(extractCorrelationIdFromJob({ data: undefined } as any)).toBeUndefined();
    });

    it('returns undefined when the field is not a non-empty string', () => {
      expect(
        extractCorrelationIdFromJob({ data: { [CORRELATION_JOB_FIELD]: '' } } as any),
      ).toBeUndefined();
      expect(
        extractCorrelationIdFromJob({ data: { [CORRELATION_JOB_FIELD]: 42 } } as any),
      ).toBeUndefined();
    });
  });
});
