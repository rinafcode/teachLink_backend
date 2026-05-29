import { CustomMetricsService } from './custom-metrics.service';
import { AlertingService } from './alerting/alerting.service';

describe('CustomMetricsService', () => {
  let customMetricsService: CustomMetricsService;
  let mockAlertingService: jest.Mocked<AlertingService>;

  beforeEach(() => {
    mockAlertingService = {
      evaluateMetricThreshold: jest.fn(),
    } as unknown as jest.Mocked<AlertingService>;

    customMetricsService = new CustomMetricsService(mockAlertingService);
  });

  describe('Metric definition system', () => {
    it('should allow registering a metric definition', () => {
      customMetricsService.define({
        name: 'test_counter',
        description: 'A test counter metric',
        type: 'counter',
      });

      const definitions = customMetricsService.getDefinitions();
      expect(definitions).toHaveLength(1);
      expect(definitions[0].name).toBe('test_counter');
      expect(definitions[0].type).toBe('counter');
    });

    it('should be idempotent when registering a metric definition', () => {
      const def = {
        name: 'test_gauge',
        description: 'A test gauge metric',
        type: 'gauge' as const,
      };

      customMetricsService.define(def);
      customMetricsService.define(def);

      const definitions = customMetricsService.getDefinitions();
      expect(definitions).toHaveLength(1);
    });
  });

  describe('Real-time metric collection', () => {
    it('should record metric samples', () => {
      customMetricsService.define({
        name: 'test_gauge',
        description: 'A test gauge metric',
        type: 'gauge',
      });

      customMetricsService.record('test_gauge', 42, { environment: 'production' });

      const samples = customMetricsService.getSamples('test_gauge');
      expect(samples).toHaveLength(1);
      expect(samples[0].value).toBe(42);
      expect(samples[0].labels).toEqual({ environment: 'production' });
      expect(samples[0].timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should auto-define gauge if metric is recorded before definition', () => {
      customMetricsService.record('auto_gauge', 10);

      const definitions = customMetricsService.getDefinitions();
      expect(definitions).toHaveLength(1);
      expect(definitions[0].name).toBe('auto_gauge');
      expect(definitions[0].type).toBe('gauge');

      const samples = customMetricsService.getSamples('auto_gauge');
      expect(samples).toHaveLength(1);
      expect(samples[0].value).toBe(10);
    });

    it('should cap the number of samples recorded', () => {
      customMetricsService.record('bounded_metric', 1);

      // Force-override MAX_SAMPLES for testing
      (customMetricsService as any).MAX_SAMPLES = 5;

      for (let i = 2; i <= 10; i++) {
        customMetricsService.record('bounded_metric', i);
      }

      const samples = customMetricsService.getSamples('bounded_metric');
      expect(samples).toHaveLength(5);
      expect(samples.map((s) => s.value)).toEqual([6, 7, 8, 9, 10]);
    });

    it('should increment counters using the increment convenience helper', () => {
      customMetricsService.increment('my_counter', 1);
      customMetricsService.increment('my_counter', 5);

      const samples = customMetricsService.getSamples('my_counter');
      expect(samples).toHaveLength(2);
      expect(samples[0].value).toBe(1);
      expect(samples[1].value).toBe(6);
    });
  });

  describe('Aggregation and computation', () => {
    it('should compute aggregations for a single metric', () => {
      customMetricsService.record('agg_metric', 10);
      customMetricsService.record('agg_metric', 20);
      customMetricsService.record('agg_metric', 30);

      const agg = customMetricsService.aggregate('agg_metric');
      expect(agg).not.toBeNull();
      expect(agg).toEqual(
        expect.objectContaining({
          name: 'agg_metric',
          count: 3,
          sum: 60,
          min: 10,
          max: 30,
          avg: 20,
          latest: 30,
        }),
      );
    });

    it('should return null when aggregating a non-existent metric', () => {
      const agg = customMetricsService.aggregate('non_existent');
      expect(agg).toBeNull();
    });

    it('should compute aggregations for all metrics', () => {
      customMetricsService.record('metric_a', 5);
      customMetricsService.record('metric_b', 15);

      const aggs = customMetricsService.aggregateAll();
      expect(aggs).toHaveLength(2);

      const names = aggs.map((a) => a.name).sort();
      expect(names).toEqual(['metric_a', 'metric_b']);
    });
  });

  describe('Alert integration', () => {
    it('should call evaluateMetricThreshold if alertThreshold is defined', () => {
      customMetricsService.define({
        name: 'alert_metric',
        description: 'A metric with alerts',
        type: 'gauge',
        alertThreshold: 80,
      });

      customMetricsService.record('alert_metric', 85);

      expect(mockAlertingService.evaluateMetricThreshold).toHaveBeenCalledWith('alert_metric', 85);
    });

    it('should not call evaluateMetricThreshold if alertThreshold is not defined', () => {
      customMetricsService.define({
        name: 'no_alert_metric',
        description: 'A metric without alerts',
        type: 'gauge',
      });

      customMetricsService.record('no_alert_metric', 85);

      expect(mockAlertingService.evaluateMetricThreshold).not.toHaveBeenCalled();
    });
  });
});
