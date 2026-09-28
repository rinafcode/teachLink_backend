import { MetricsCollectionService } from '../../src/monitoring/metrics/metrics-collection.service';
import { CostTrackingService } from '../../src/monitoring/cost-tracking.service';

describe('CostTrackingService', () => {
  let metrics: MetricsCollectionService;
  let svc: CostTrackingService;

  beforeEach(() => {
    metrics = new MetricsCollectionService();
    svc = new CostTrackingService(metrics);
  });

  it('should maintain rolling 24h window and evaluate budget', () => {
    for (let i = 0; i < 25; i++) {
      svc.recordHourlyCost(2); // push 25 hours of $2 => last24h 48
    }

    expect(svc.getLast24hCost()).toBeCloseTo(48);
    expect(svc.evaluateBudget(40)).toBe(true);
    expect(svc.evaluateBudget(100)).toBe(false);
  });
});
