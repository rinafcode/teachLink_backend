import { Test, TestingModule } from '@nestjs/testing';
import { StreamOptimizationService } from './stream-optimization.service';
import { take, toArray } from 'rxjs/operators';

describe('StreamOptimizationService', () => {
  let service: StreamOptimizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StreamOptimizationService],
    }).compile();

    service = module.get<StreamOptimizationService>(StreamOptimizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trackMetric', () => {
    it('should track performance metrics', () => {
      // Track metrics
      service.trackMetric('throughput', 100);
      service.trackMetric('latency', 50);
      service.trackMetric('backpressure', 0.2);
      service.trackMetric('bufferSize', 200);

      // Get current metrics
      const metrics = service.getCurrentMetrics();

      expect(metrics.throughput).toBe(100);
      expect(metrics.latency).toBe(50);
      expect(metrics.backpressure).toBe(0.2);
      expect(metrics.bufferSize).toBe(200);
      expect(metrics.timestamp).toBeDefined();
    });

    it('should update existing metrics', () => {
      // Track initial metrics
      service.trackMetric('throughput', 100);
      
      // Update metrics
      service.trackMetric('throughput', 150);
      
      // Get current metrics
      const metrics = service.getCurrentMetrics();
      
      expect(metrics.throughput).toBe(150);
    });
  });

  describe('observeMetrics', () => {
    it('should emit metrics when they change', (done) => {
      // Subscribe to metrics
      service.observeMetrics()
        .pipe(take(1))
        .subscribe(metrics => {
          expect(metrics.throughput).toBe(100);
          done();
        });
      
      // Track metrics to trigger emission
      service.trackMetric('throughput', 100);
    });
  });

  describe('applyThrottling', () => {
    it('should apply throttling when throughput exceeds threshold', () => {
      // Set up initial metrics
      service.trackMetric('throughput', 200);
      
      // Apply throttling with threshold of 100
      const result = service.applyThrottling(100);
      
      expect(result.applied).toBe(true);
      expect(result.strategy).toBe('throttling');
      expect(result.currentThroughput).toBe(200);
      expect(result.threshold).toBe(100);
    });

    it('should not apply throttling when throughput is below threshold', () => {
      // Set up initial metrics
      service.trackMetric('throughput', 50);
      
      // Apply throttling with threshold of 100
      const result = service.applyThrottling(100);
      
      expect(result.applied).toBe(false);
      expect(result.strategy).toBe('throttling');
      expect(result.currentThroughput).toBe(50);
      expect(result.threshold).toBe(100);
    });
  });

  describe('applyBuffering', () => {
    it('should apply buffering when backpressure exceeds threshold', () => {
      // Set up initial metrics
      service.trackMetric('backpressure', 0.8);
      
      // Apply buffering with threshold of 0.5
      const result = service.applyBuffering(0.5, 1000);
      
      expect(result.applied).toBe(true);
      expect(result.strategy).toBe('buffering');
      expect(result.currentBackpressure).toBe(0.8);
      expect(result.threshold).toBe(0.5);
      expect(result.bufferSize).toBe(1000);
    });

    it('should not apply buffering when backpressure is below threshold', () => {
      // Set up initial metrics
      service.trackMetric('backpressure', 0.3);
      
      // Apply buffering with threshold of 0.5
      const result = service.applyBuffering(0.5, 1000);
      
      expect(result.applied).toBe(false);
      expect(result.strategy).toBe('buffering');
      expect(result.currentBackpressure).toBe(0.3);
      expect(result.threshold).toBe(0.5);
    });
  });

  describe('getMetricsHistory', () => {
    it('should return metrics history', () => {
      // Track metrics at different times
      const now = Date.now();
      
      // Manually set metrics with timestamps
      service['metricsHistory'] = [
        { throughput: 100, latency: 50, backpressure: 0.2, bufferSize: 200, timestamp: now - 2000 },
        { throughput: 120, latency: 55, backpressure: 0.3, bufferSize: 220, timestamp: now - 1000 },
        { throughput: 140, latency: 60, backpressure: 0.4, bufferSize: 240, timestamp: now },
      ];
      
      // Get metrics history
      const history = service.getMetricsHistory();
      
      expect(history).toHaveLength(3);
      expect(history[0].throughput).toBe(100);
      expect(history[1].throughput).toBe(120);
      expect(history[2].throughput).toBe(140);
    });

    it('should limit history to maxHistorySize', () => {
      // Set a small history size
      service['maxHistorySize'] = 2;
      
      // Track metrics multiple times
      service.trackMetric('throughput', 100);
      service.trackMetric('throughput', 200);
      service.trackMetric('throughput', 300);
      
      // Get metrics history
      const history = service.getMetricsHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].throughput).toBe(200);
      expect(history[1].throughput).toBe(300);
    });
  });

  describe('detectPerformanceIssues', () => {
    it('should detect high latency issues', () => {
      // Set up metrics with high latency
      service.trackMetric('latency', 500); // 500ms latency
      
      // Detect issues with latency threshold of 100ms
      const issues = service.detectPerformanceIssues({
        latencyThreshold: 100,
        throughputThreshold: 1000,
        backpressureThreshold: 0.8,
      });
      
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('high_latency');
      expect(issues[0].currentValue).toBe(500);
      expect(issues[0].threshold).toBe(100);
    });

    it('should detect multiple issues', () => {
      // Set up metrics with multiple issues
      service.trackMetric('latency', 500); // High latency
      service.trackMetric('backpressure', 0.9); // High backpressure
      
      // Detect issues
      const issues = service.detectPerformanceIssues({
        latencyThreshold: 100,
        throughputThreshold: 1000,
        backpressureThreshold: 0.8,
      });
      
      expect(issues).toHaveLength(2);
      expect(issues[0].type).toBe('high_latency');
      expect(issues[1].type).toBe('high_backpressure');
    });

    it('should return empty array when no issues detected', () => {
      // Set up metrics with no issues
      service.trackMetric('latency', 50);
      service.trackMetric('throughput', 500);
      service.trackMetric('backpressure', 0.3);
      
      // Detect issues
      const issues = service.detectPerformanceIssues({
        latencyThreshold: 100,
        throughputThreshold: 1000,
        backpressureThreshold: 0.8,
      });
      
      expect(issues).toHaveLength(0);
    });
  });
});