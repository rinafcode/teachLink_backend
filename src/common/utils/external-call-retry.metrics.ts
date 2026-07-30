import { Counter, Registry, register as defaultRegistry } from 'prom-client';
import { RetryAttemptContext } from './retry-policy';

/**
 * Prometheus instrumentation for the retry policy (issue #886).
 *
 * Kept separate from `retry-policy.ts` so the policy itself stays
 * dependency-free and usable in contexts without a metrics registry.
 *
 * `attempt` is a label rather than a histogram bucket because the cardinality
 * is bounded by `maxRetries`, and knowing whether failures clear on retry 1 or
 * only on retry 3 is the interesting signal when tuning the policy.
 */
export const EXTERNAL_CALL_RETRY_METRIC = 'external_call_retry_total';

export type ExternalCallRetryLabels = 'service' | 'attempt';

/**
 * Returns the shared counter, registering it on first use.
 *
 * prom-client throws if a metric name is registered twice, which is easy to
 * trigger when several services instrument themselves against the same
 * registry. Looking the metric up first makes this safe to call anywhere.
 */
export function getExternalCallRetryCounter(
  registry: Registry = defaultRegistry,
): Counter<ExternalCallRetryLabels> {
  const existing = registry.getSingleMetric(EXTERNAL_CALL_RETRY_METRIC);
  if (existing) {
    return existing as Counter<ExternalCallRetryLabels>;
  }

  return new Counter({
    name: EXTERNAL_CALL_RETRY_METRIC,
    help: 'Total retries performed against external services, by service and attempt number',
    labelNames: ['service', 'attempt'] as const,
    registers: [registry],
  });
}

/** Increments the retry counter for one attempt against one service. */
export function recordExternalCallRetry(
  service: string,
  attempt: number,
  registry: Registry = defaultRegistry,
): void {
  getExternalCallRetryCounter(registry).inc({ service, attempt: String(attempt) });
}

/**
 * Builds an `onRetry` hook bound to one service, for handing straight to
 * `retryWithPolicy`:
 *
 * ```ts
 * await retryWithPolicy((attempt) => provider.send(payload), {
 *   service: 'email',
 *   onRetry: createRetryMetricsHook('email'),
 * });
 * ```
 */
export function createRetryMetricsHook(
  service: string,
  registry: Registry = defaultRegistry,
): (context: RetryAttemptContext) => void {
  return ({ attempt }: RetryAttemptContext) => recordExternalCallRetry(service, attempt, registry);
}
