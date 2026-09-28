import { generateCorrelationId, getCorrelationId } from '../../common/utils/correlation.utils';

export const CORRELATION_JOB_FIELD = '__correlationId';

/**
 * Adds the active correlation ID (or a freshly generated one) to the job
 * payload so that a worker consuming the job can restore the originating
 * AsyncLocalStorage context. Producers MUST call this when adding jobs so
 * that downstream consumers can correlate logs back to the source HTTP
 * request.
 */
export function enrichWithCorrelation<T extends Record<string, unknown>>(
  data: T,
): T & { [CORRELATION_JOB_FIELD]: string } {
  const correlationId = getCorrelationId() ?? generateCorrelationId();
  return {
    ...data,
    [CORRELATION_JOB_FIELD]: correlationId,
  };
}

/**
 * Reads the correlation ID embedded into the job payload by the producer,
 * falling back to undefined when no value is present.
 */
export function extractCorrelationIdFromJob(job: { data: unknown }): string | undefined {
  const data = (job?.data ?? {}) as Record<string, unknown>;
  const value = data[CORRELATION_JOB_FIELD];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
