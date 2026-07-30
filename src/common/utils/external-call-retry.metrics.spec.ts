import { Registry } from 'prom-client';
import {
  EXTERNAL_CALL_RETRY_METRIC,
  createRetryMetricsHook,
  getExternalCallRetryCounter,
  recordExternalCallRetry,
} from './external-call-retry.metrics';

describe('external call retry metrics', () => {
  let registry: Registry;

  beforeEach(() => {
    // A dedicated registry keeps these assertions isolated from the global one.
    registry = new Registry();
  });

  it('registers the counter under the documented metric name', async () => {
    getExternalCallRetryCounter(registry);

    const [metric] = await registry.getMetricsAsJSON();

    expect(metric.name).toBe(EXTERNAL_CALL_RETRY_METRIC);
    expect(metric.help).toContain('external services');
  });

  it('reuses an already registered counter instead of throwing', () => {
    const first = getExternalCallRetryCounter(registry);
    const second = getExternalCallRetryCounter(registry);

    expect(second).toBe(first);
  });

  it('counts retries per service and attempt', async () => {
    recordExternalCallRetry('email', 1, registry);
    recordExternalCallRetry('email', 2, registry);
    recordExternalCallRetry('payments', 1, registry);

    const [metric] = await registry.getMetricsAsJSON();

    expect(metric.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ labels: { service: 'email', attempt: '1' }, value: 1 }),
        expect.objectContaining({ labels: { service: 'email', attempt: '2' }, value: 1 }),
        expect.objectContaining({ labels: { service: 'payments', attempt: '1' }, value: 1 }),
      ]),
    );
  });

  it('accumulates repeated retries against the same labels', async () => {
    recordExternalCallRetry('cdn', 1, registry);
    recordExternalCallRetry('cdn', 1, registry);

    const [metric] = await registry.getMetricsAsJSON();

    expect(metric.values).toEqual([
      expect.objectContaining({ labels: { service: 'cdn', attempt: '1' }, value: 2 }),
    ]);
  });

  it('builds an onRetry hook that labels the counter with its service', async () => {
    const hook = createRetryMetricsHook('cdn', registry);

    hook({ attempt: 3, delayMs: 4_000, error: new Error('503') });

    const [metric] = await registry.getMetricsAsJSON();

    expect(metric.values).toEqual([
      expect.objectContaining({ labels: { service: 'cdn', attempt: '3' }, value: 1 }),
    ]);
  });
});
