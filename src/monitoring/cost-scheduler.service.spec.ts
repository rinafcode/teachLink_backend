import { Registry } from 'prom-client';
import { AwsCostCollectorService, HourlyCostResult } from './cloud/aws-cost-collector.service';
import { CostSchedulerService } from './cost-scheduler.service';
import { CostTrackingService } from './cost-tracking.service';
import { MetricsCollectionService } from './metrics/metrics-collection.service';

/**
 * Minimal MetricsCollectionService stub that provides an isolated Registry so
 * prom-client does not pollute the global default registry between tests.
 */
function makeMetricsStub(): MetricsCollectionService {
  const registry = new Registry();
  return {
    getRegistry: () => registry,
  } as unknown as MetricsCollectionService;
}

describe('CostSchedulerService', () => {
  let scheduler: CostSchedulerService;
  let collector: jest.Mocked<Pick<AwsCostCollectorService, 'collectHourlyCost'>>;
  let costService: jest.Mocked<Pick<CostTrackingService, 'recordHourlyCost'>>;
  let metricsStub: MetricsCollectionService;

  beforeEach(() => {
    metricsStub = makeMetricsStub();

    collector = {
      collectHourlyCost: jest.fn(),
    };

    costService = {
      recordHourlyCost: jest.fn().mockResolvedValue(undefined),
    };

    scheduler = new CostSchedulerService(
      collector as unknown as AwsCostCollectorService,
      costService as unknown as CostTrackingService,
      metricsStub,
    );
  });

  // ── Success path ───────────────────────────────────────────────────────────

  describe('when the collector returns a result', () => {
    const result: HourlyCostResult = { amount: 3.14, billingPeriod: '2026-07-25/2026-07-26' };

    beforeEach(() => {
      collector.collectHourlyCost.mockResolvedValue(result);
    });

    it('delegates to AwsCostCollectorService to fetch the real cost', async () => {
      await scheduler.recordHourlyCost();
      expect(collector.collectHourlyCost).toHaveBeenCalledTimes(1);
    });

    it('records the amount returned by the collector', async () => {
      await scheduler.recordHourlyCost();
      expect(costService.recordHourlyCost).toHaveBeenCalledWith(result.amount, result.billingPeriod);
    });

    it('labels the metric with the billing period the amount covers', async () => {
      await scheduler.recordHourlyCost();
      expect(costService.recordHourlyCost).toHaveBeenCalledWith(
        expect.any(Number),
        '2026-07-25/2026-07-26',
      );
    });

    it('does not increment the failure counter on success', async () => {
      await scheduler.recordHourlyCost();

      const registry = metricsStub.getRegistry();
      const counter = registry.getSingleMetric('cost_collection_failures_total');
      expect(counter).toBeDefined();

      // Counter should remain at zero after a successful collection.
      const metrics = await registry.metrics();
      expect(metrics).toMatch(/cost_collection_failures_total 0/);
    });
  });

  // ── Failure path ───────────────────────────────────────────────────────────

  describe('when the collector returns null (failure)', () => {
    beforeEach(() => {
      collector.collectHourlyCost.mockResolvedValue(null);
    });

    it('does not call recordHourlyCost — leaves the previous metric value intact', async () => {
      await scheduler.recordHourlyCost();
      expect(costService.recordHourlyCost).not.toHaveBeenCalled();
    });

    it('increments the cost_collection_failures_total counter', async () => {
      await scheduler.recordHourlyCost();

      const registry = metricsStub.getRegistry();
      const metrics = await registry.metrics();
      expect(metrics).toMatch(/cost_collection_failures_total 1/);
    });

    it('increments the failure counter once per failed cycle', async () => {
      await scheduler.recordHourlyCost();
      await scheduler.recordHourlyCost();

      const registry = metricsStub.getRegistry();
      const metrics = await registry.metrics();
      expect(metrics).toMatch(/cost_collection_failures_total 2/);
    });
  });

  // ── No placeholder / no TODO ───────────────────────────────────────────────

  describe('implementation hygiene', () => {
    it('never publishes a hard-coded placeholder amount', async () => {
      // Confirm the scheduler never calls recordHourlyCost with the old
      // placeholder value of 0 when the collector is not invoked.
      collector.collectHourlyCost.mockResolvedValue(null);

      await scheduler.recordHourlyCost();

      expect(costService.recordHourlyCost).not.toHaveBeenCalledWith(0, expect.anything());
      expect(costService.recordHourlyCost).not.toHaveBeenCalled();
    });
  });
});
