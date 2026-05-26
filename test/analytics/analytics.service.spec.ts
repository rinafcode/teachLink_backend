import { MetricsCollectionService } from '../../src/monitoring/metrics/metrics-collection.service';
import { AnalyticsService } from '../../src/analytics/analytics.service';

describe('AnalyticsService', () => {
  let metrics: MetricsCollectionService;
  let svc: AnalyticsService;

  beforeEach(() => {
    metrics = new MetricsCollectionService();
    svc = new AnalyticsService(metrics);
  });

  it('should record an event (no throw)', () => {
    expect(() => svc.recordEvent('feature', 'clicked')).not.toThrow();
  });
});
