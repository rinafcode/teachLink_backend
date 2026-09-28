import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CanaryMetricsService } from './canary-metrics.service';

describe('CanaryMetricsService', () => {
  let service: CanaryMetricsService;

  const originalEnv = process.env;

  beforeEach(async () => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CanaryMetricsService],
    }).compile();

    service = module.get<CanaryMetricsService>(CanaryMetricsService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  /** Convenience helper to build a MirrorResult with sensible defaults */
  function makeResult(
    overrides?: Partial<import('./canary-metrics.service').MirrorResult>,
  ): import('./canary-metrics.service').MirrorResult {
    return {
      path: '/api/test',
      method: 'GET',
      statusCode: 200,
      durationMs: 50,
      success: true,
      ...overrides,
    };
  }

  // -----------------------------------------------------------
  // getStats – empty state
  // -----------------------------------------------------------
  describe('getStats (empty)', () => {
    it('should return zero stats when no results recorded', () => {
      const stats = service.getStats();
      expect(stats).toEqual({
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        averageDurationMs: 0,
        successRate: 0,
      });
    });
  });

  // -----------------------------------------------------------
  // recordMirrorResult
  // -----------------------------------------------------------
  describe('recordMirrorResult', () => {
    it('should add a result to the internal collection', () => {
      service.recordMirrorResult(makeResult());
      const stats = service.getStats();
      expect(stats.totalRequests).toBe(1);
    });

    it('should accumulate multiple results', () => {
      service.recordMirrorResult(makeResult({ success: true, durationMs: 10 }));
      service.recordMirrorResult(makeResult({ success: false, durationMs: 20 }));
      service.recordMirrorResult(makeResult({ success: true, durationMs: 30 }));

      const stats = service.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
    });
  });

  // -----------------------------------------------------------
  // getStats – populated
  // -----------------------------------------------------------
  describe('getStats (populated)', () => {
    it('should compute correct counts for all-success results', () => {
      for (let i = 0; i < 5; i++) {
        service.recordMirrorResult(makeResult({ success: true, durationMs: 100 }));
      }

      const stats = service.getStats();
      expect(stats.successCount).toBe(5);
      expect(stats.failureCount).toBe(0);
      expect(stats.successRate).toBe(1);
    });

    it('should compute correct counts for all-failure results', () => {
      for (let i = 0; i < 4; i++) {
        service.recordMirrorResult(makeResult({ success: false, durationMs: 200 }));
      }

      const stats = service.getStats();
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(4);
      expect(stats.successRate).toBe(0);
    });

    it('should compute averageDurationMs rounded to nearest integer', () => {
      service.recordMirrorResult(makeResult({ durationMs: 10 }));
      service.recordMirrorResult(makeResult({ durationMs: 15 }));
      // Average = 12.5 → rounded to 12 or 13 depending on Math.round
      const stats = service.getStats();
      expect(stats.averageDurationMs).toBe(13);
    });

    it('should compute successRate rounded to two decimal places', () => {
      // 3 out of 4 = 0.75
      for (let i = 0; i < 3; i++) {
        service.recordMirrorResult(makeResult({ success: true }));
      }
      service.recordMirrorResult(makeResult({ success: false }));

      const stats = service.getStats();
      expect(stats.successRate).toBe(0.75);
    });

    it('should handle mixed durations correctly', () => {
      service.recordMirrorResult(makeResult({ durationMs: 100 }));
      service.recordMirrorResult(makeResult({ durationMs: 300 }));

      const stats = service.getStats();
      expect(stats.averageDurationMs).toBe(200);
    });
  });

  // -----------------------------------------------------------
  // evaluateCanary – PROMOTE signal
  // -----------------------------------------------------------
  describe('evaluateCanary – PROMOTE', () => {
    it('should log PROMOTE when success rate >= threshold with enough samples', async () => {
      process.env.CANARY_PROMOTE_THRESHOLD = '0.90';
      process.env.CANARY_MIN_SAMPLE_SIZE = '5';

      const module: TestingModule = await Test.createTestingModule({
        providers: [CanaryMetricsService],
      }).compile();
      const svc = module.get<CanaryMetricsService>(CanaryMetricsService);

      const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

      // 9 successes, 1 failure → 0.90 success rate ≥ 0.90 threshold
      for (let i = 0; i < 9; i++) {
        svc.recordMirrorResult(makeResult({ success: true }));
      }
      svc.recordMirrorResult(makeResult({ success: false }));

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Canary PROMOTE signal'));
    });

    it('should log PROMOTE when all requests succeed', async () => {
      process.env.CANARY_PROMOTE_THRESHOLD = '0.95';
      process.env.CANARY_MIN_SAMPLE_SIZE = '3';

      const module: TestingModule = await Test.createTestingModule({
        providers: [CanaryMetricsService],
      }).compile();
      const svc = module.get<CanaryMetricsService>(CanaryMetricsService);

      const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

      for (let i = 0; i < 5; i++) {
        svc.recordMirrorResult(makeResult({ success: true }));
      }

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Canary PROMOTE signal'));
    });
  });

  // -----------------------------------------------------------
  // evaluateCanary – ROLLBACK signal
  // -----------------------------------------------------------
  describe('evaluateCanary – ROLLBACK', () => {
    it('should log ROLLBACK when success rate < rollback threshold', async () => {
      process.env.CANARY_ROLLBACK_THRESHOLD = '0.70';
      process.env.CANARY_MIN_SAMPLE_SIZE = '5';

      const module: TestingModule = await Test.createTestingModule({
        providers: [CanaryMetricsService],
      }).compile();
      const svc = module.get<CanaryMetricsService>(CanaryMetricsService);

      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      // 2 successes, 8 failures → 0.20 < 0.70
      for (let i = 0; i < 2; i++) {
        svc.recordMirrorResult(makeResult({ success: true }));
      }
      for (let i = 0; i < 8; i++) {
        svc.recordMirrorResult(makeResult({ success: false }));
      }

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Canary ROLLBACK signal'));
    });

    it('should not log ROLLBACK when success rate is between rollback and promote thresholds', async () => {
      process.env.CANARY_PROMOTE_THRESHOLD = '0.95';
      process.env.CANARY_ROLLBACK_THRESHOLD = '0.70';
      process.env.CANARY_MIN_SAMPLE_SIZE = '5';

      const module: TestingModule = await Test.createTestingModule({
        providers: [CanaryMetricsService],
      }).compile();
      const svc = module.get<CanaryMetricsService>(CanaryMetricsService);

      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      // 8 successes, 2 failures → 0.80 is between 0.70 and 0.95
      for (let i = 0; i < 8; i++) {
        svc.recordMirrorResult(makeResult({ success: true }));
      }
      for (let i = 0; i < 2; i++) {
        svc.recordMirrorResult(makeResult({ success: false }));
      }

      expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Canary ROLLBACK signal'));
    });
  });

  // -----------------------------------------------------------
  // evaluateCanary – below min sample size
  // -----------------------------------------------------------
  describe('evaluateCanary – below minSampleSize', () => {
    it('should not log any signal when total requests < minSampleSize', async () => {
      process.env.CANARY_PROMOTE_THRESHOLD = '0.95';
      process.env.CANARY_ROLLBACK_THRESHOLD = '0.70';
      process.env.CANARY_MIN_SAMPLE_SIZE = '20';

      const module: TestingModule = await Test.createTestingModule({
        providers: [CanaryMetricsService],
      }).compile();
      const svc = module.get<CanaryMetricsService>(CanaryMetricsService);

      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      // Only 3 requests — well below the default minSampleSize of 20
      for (let i = 0; i < 3; i++) {
        svc.recordMirrorResult(makeResult({ success: true }));
      }

      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Canary PROMOTE signal'));
      expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Canary ROLLBACK signal'));
    });
  });

  // -----------------------------------------------------------
  // env-var defaults
  // -----------------------------------------------------------
  describe('env-var defaults', () => {
    it('should use default thresholds when env vars are not set', async () => {
      delete process.env.CANARY_PROMOTE_THRESHOLD;
      delete process.env.CANARY_ROLLBACK_THRESHOLD;
      delete process.env.CANARY_MIN_SAMPLE_SIZE;

      const module: TestingModule = await Test.createTestingModule({
        providers: [CanaryMetricsService],
      }).compile();
      const svc = module.get<CanaryMetricsService>(CanaryMetricsService);

      // Record 20 results with 100% success → should PROMOTE (≥0.95)
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
      for (let i = 0; i < 20; i++) {
        svc.recordMirrorResult(makeResult({ success: true }));
      }

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Canary PROMOTE signal'));
    });
  });
});
