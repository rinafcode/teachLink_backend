import { Test, TestingModule } from '@nestjs/testing';
import { RealTimeAnalyticsService, AnalyticsMetric, TimeWindowAggregation } from './real-time-analytics.service';
import { take, toArray } from 'rxjs/operators';

describe('RealTimeAnalyticsService', () => {
  let service: RealTimeAnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RealTimeAnalyticsService],
    }).compile();

    service = module.get<RealTimeAnalyticsService>(RealTimeAnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trackMetric and observeMetrics', () => {
    it('should track metrics and allow observation by key', (done) => {
      // Create test metrics
      const metric1: AnalyticsMetric = {
        key: 'page_views',
        value: 1,
        dimensions: { page: 'home' },
        timestamp: Date.now(),
      };

      const metric2: AnalyticsMetric = {
        key: 'page_views',
        value: 1,
        dimensions: { page: 'profile' },
        timestamp: Date.now(),
      };

      const metric3: AnalyticsMetric = {
        key: 'clicks',
        value: 1,
        dimensions: { button: 'signup' },
        timestamp: Date.now(),
      };

      // Subscribe to page_views metrics
      service.observeMetrics('page_views')
        .pipe(take(2), toArray())
        .subscribe(metrics => {
          expect(metrics).toHaveLength(2);
          expect(metrics[0].key).toBe('page_views');
          expect(metrics[0].dimensions.page).toBe('home');
          expect(metrics[1].dimensions.page).toBe('profile');
          done();
        });

      // Track metrics
      service.trackMetric(metric1);
      service.trackMetric(metric3); // This should not be received by our subscription
      service.trackMetric(metric2);
    });

    it('should allow subscription to all metrics when no key is specified', (done) => {
      // Create test metrics
      const metric1: AnalyticsMetric = {
        key: 'page_views',
        value: 1,
        dimensions: { page: 'home' },
        timestamp: Date.now(),
      };

      const metric2: AnalyticsMetric = {
        key: 'clicks',
        value: 1,
        dimensions: { button: 'signup' },
        timestamp: Date.now(),
      };

      // Subscribe to all metrics
      service.observeMetrics()
        .pipe(take(2), toArray())
        .subscribe(metrics => {
          expect(metrics).toHaveLength(2);
          expect(metrics[0].key).toBe('page_views');
          expect(metrics[1].key).toBe('clicks');
          done();
        });

      // Track metrics
      service.trackMetric(metric1);
      service.trackMetric(metric2);
    });
  });

  describe('createTimeWindowAggregation', () => {
    it('should create time window aggregations', (done) => {
      // Create time window config
      const windowConfig = {
        key: 'page_views',
        windowSize: 1000, // 1 second
        aggregationType: 'sum',
      };

      // Create time window aggregation
      const aggregation = service.createTimeWindowAggregation(windowConfig);

      // Subscribe to aggregation
      aggregation.pipe(take(1)).subscribe(result => {
        expect(result.key).toBe('page_views');
        expect(result.value).toBe(3); // Sum of all values
        expect(result.windowSize).toBe(1000);
        expect(result.aggregationType).toBe('sum');
        done();
      });

      // Track metrics within the time window
      service.trackMetric({
        key: 'page_views',
        value: 1,
        dimensions: { page: 'home' },
        timestamp: Date.now(),
      });

      service.trackMetric({
        key: 'page_views',
        value: 2,
        dimensions: { page: 'profile' },
        timestamp: Date.now(),
      });

      // Simulate time passing to trigger window completion
      setTimeout(() => {
        // This metric should not be included in the aggregation
        service.trackMetric({
          key: 'page_views',
          value: 5,
          dimensions: { page: 'settings' },
          timestamp: Date.now(),
        });
      }, 1100);
    });
  });

  describe('storeAggregation and getAggregationHistory', () => {
    it('should store and retrieve aggregation history', () => {
      // Create test aggregations
      const aggregation1: TimeWindowAggregation = {
        key: 'page_views',
        value: 10,
        timestamp: Date.now() - 2000,
        windowSize: 1000,
        aggregationType: 'sum',
      };

      const aggregation2: TimeWindowAggregation = {
        key: 'page_views',
        value: 15,
        timestamp: Date.now() - 1000,
        windowSize: 1000,
        aggregationType: 'sum',
      };

      const aggregation3: TimeWindowAggregation = {
        key: 'page_views',
        value: 20,
        timestamp: Date.now(),
        windowSize: 1000,
        aggregationType: 'sum',
      };

      // Store aggregations
      service.storeAggregation(aggregation1);
      service.storeAggregation(aggregation2);
      service.storeAggregation(aggregation3);

      // Retrieve aggregation history
      const history = service.getAggregationHistory('page_views');

      expect(history).toHaveLength(3);
      expect(history[0].value).toBe(10);
      expect(history[1].value).toBe(15);
      expect(history[2].value).toBe(20);
    });

    it('should return empty array for non-existent key', () => {
      const history = service.getAggregationHistory('non_existent_key');
      expect(history).toEqual([]);
    });
  });

  describe('calculateEventRate', () => {
    it('should calculate event rate correctly', () => {
      // Create test metrics with timestamps 100ms apart
      const baseTime = Date.now();
      
      service.trackMetric({
        key: 'api_calls',
        value: 1,
        dimensions: { endpoint: '/users' },
        timestamp: baseTime,
      });

      service.trackMetric({
        key: 'api_calls',
        value: 1,
        dimensions: { endpoint: '/posts' },
        timestamp: baseTime + 100,
      });

      service.trackMetric({
        key: 'api_calls',
        value: 1,
        dimensions: { endpoint: '/comments' },
        timestamp: baseTime + 200,
      });

      // Calculate event rate over the last 300ms
      // 3 events in 0.3 seconds = 10 events per second
      const rate = service.calculateEventRate('api_calls', 300);
      
      // Allow some flexibility in the test due to timing
      expect(rate).toBeGreaterThanOrEqual(9);
      expect(rate).toBeLessThanOrEqual(11);
    });

    it('should return 0 for non-existent key', () => {
      const rate = service.calculateEventRate('non_existent_key', 1000);
      expect(rate).toBe(0);
    });
  });

  describe('detectAnomaly', () => {
    it('should detect anomalies based on z-score', () => {
      // Create history of aggregations
      const baseTime = Date.now() - 10000;
      
      // Create a stable pattern
      for (let i = 0; i < 10; i++) {
        service.storeAggregation({
          key: 'api_errors',
          value: 5, // Stable value
          timestamp: baseTime + i * 1000,
          windowSize: 1000,
          aggregationType: 'sum',
        });
      }
      
      // Test with a value within normal range
      const normalValue = 6;
      const normalResult = service.detectAnomaly('api_errors', normalValue, 3.0); // 3 std deviations
      
      expect(normalResult.isAnomaly).toBe(false);
      
      // Test with an anomalous value
      const anomalyValue = 20; // Much higher than the stable pattern
      const anomalyResult = service.detectAnomaly('api_errors', anomalyValue, 3.0);
      
      expect(anomalyResult.isAnomaly).toBe(true);
      expect(anomalyResult.score).toBeGreaterThan(3.0);
    });

    it('should not detect anomaly with insufficient history', () => {
      // Test with no history
      const result = service.detectAnomaly('new_metric', 100, 3.0);
      
      expect(result.isAnomaly).toBe(false);
      expect(result.score).toBe(0);
      expect(result.message).toContain('insufficient history');
    });
  });
});