import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter } from 'events';
import { RequestTrackerService } from './request-tracker.service';

/** Create a mock Express Request with optional overrides */
function createMockReq(overrides?: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
}) {
  const headers: Record<string, string> = overrides?.headers ?? {};
  return {
    method: overrides?.method ?? 'GET',
    url: overrides?.url ?? '/test',
    get: (name: string) => headers[name.toLowerCase()] ?? headers[name] ?? undefined,
  } as any;
}

/** Create a mock Express Response that behaves like an EventEmitter for lifecycle events */
function createMockRes() {
  const emitter = new EventEmitter();
  const res: any = {
    locals: {} as Record<string, any>,
    on: (event: string, fn: (...args: any[]) => void) => {
      emitter.on(event, fn);
      return res;
    },
  };
  // Expose a helper so tests can trigger lifecycle events
  res._emit = (event: string) => emitter.emit(event);
  return res;
}

describe('RequestTrackerService', () => {
  let service: RequestTrackerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RequestTrackerService],
    }).compile();

    service = module.get<RequestTrackerService>(RequestTrackerService);
  });

  // -----------------------------------------------------------
  // trackRequest() – middleware
  // -----------------------------------------------------------
  describe('trackRequest', () => {
    it('should return a function', () => {
      const middleware = service.trackRequest();
      expect(typeof middleware).toBe('function');
    });

    it('should call next()', () => {
      const next = jest.fn();
      service.trackRequest()(createMockReq(), createMockRes(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should track the request after calling next', () => {
      const next = jest.fn();
      service.trackRequest()(createMockReq(), createMockRes(), next);
      expect(service.getActiveRequestCount()).toBe(1);
    });

    it('should store requestId in res.locals', () => {
      const res = createMockRes();
      service.trackRequest()(createMockReq(), res, jest.fn());
      expect(typeof res.locals.requestId).toBe('string');
      expect(res.locals.requestId).toMatch(/^req-/);
    });

    it('should capture method, url, userAgent and correlationId', () => {
      const next = jest.fn();
      service.trackRequest()(
        createMockReq({
          method: 'POST',
          url: '/api/items',
          headers: { 'user-agent': 'TestAgent/1.0', 'x-correlation-id': 'corr-123' },
        }),
        createMockRes(),
        next,
      );

      const [req] = service.getActiveRequests();
      expect(req.method).toBe('POST');
      expect(req.url).toBe('/api/items');
      expect(req.userAgent).toBe('TestAgent/1.0');
      expect(req.correlationId).toBe('corr-123');
    });

    it('should clean up the request on "finish"', () => {
      const res = createMockRes();
      service.trackRequest()(createMockReq(), res, jest.fn());
      expect(service.getActiveRequestCount()).toBe(1);

      res._emit('finish');
      expect(service.getActiveRequestCount()).toBe(0);
    });

    it('should clean up the request on "close"', () => {
      const res = createMockRes();
      service.trackRequest()(createMockReq(), res, jest.fn());
      res._emit('close');
      expect(service.getActiveRequestCount()).toBe(0);
    });

    it('should clean up the request on "error"', () => {
      const res = createMockRes();
      service.trackRequest()(createMockReq(), res, jest.fn());
      res._emit('error');
      expect(service.getActiveRequestCount()).toBe(0);
    });

    it('should be idempotent on cleanup — double finish/delete is safe', () => {
      const res = createMockRes();
      service.trackRequest()(createMockReq(), res, jest.fn());
      res._emit('finish');
      expect(() => res._emit('finish')).not.toThrow();
      expect(service.getActiveRequestCount()).toBe(0);
    });

    it('should track multiple concurrent requests independently', () => {
      const res1 = createMockRes();
      const res2 = createMockRes();
      service.trackRequest()(createMockReq(), res1, jest.fn());
      service.trackRequest()(createMockReq(), res2, jest.fn());
      expect(service.getActiveRequestCount()).toBe(2);

      res1._emit('finish');
      expect(service.getActiveRequestCount()).toBe(1);
      res2._emit('finish');
      expect(service.getActiveRequestCount()).toBe(0);
    });
  });

  // -----------------------------------------------------------
  // getActiveRequestCount / getActiveRequests
  // -----------------------------------------------------------
  describe('getActiveRequestCount / getActiveRequests', () => {
    it('should return 0 and empty array initially', () => {
      expect(service.getActiveRequestCount()).toBe(0);
      expect(service.getActiveRequests()).toEqual([]);
    });

    it('should reflect added and removed requests', () => {
      const res = createMockRes();
      service.trackRequest()(createMockReq(), res, jest.fn());
      expect(service.getActiveRequestCount()).toBe(1);
      expect(service.getActiveRequests()).toHaveLength(1);

      res._emit('close');
      expect(service.getActiveRequestCount()).toBe(0);
      expect(service.getActiveRequests()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------
  // forceCleanupRequest
  // -----------------------------------------------------------
  describe('forceCleanupRequest', () => {
    it('should return true and remove the request when it exists', () => {
      const next = jest.fn();
      service.trackRequest()(createMockReq(), createMockRes(), next);
      const [req] = service.getActiveRequests();

      const removed = service.forceCleanupRequest(req.id);
      expect(removed).toBe(true);
      expect(service.getActiveRequestCount()).toBe(0);
    });

    it('should return false for a non-existent request id', () => {
      const removed = service.forceCleanupRequest('req-fake-id');
      expect(removed).toBe(false);
    });

    it('should only remove the targeted request', () => {
      const next = jest.fn();
      service.trackRequest()(createMockReq(), createMockRes(), next);
      service.trackRequest()(createMockReq(), createMockRes(), next);
      const [target] = service.getActiveRequests();

      service.forceCleanupRequest(target.id);
      expect(service.getActiveRequestCount()).toBe(1);
    });
  });

  // -----------------------------------------------------------
  // logActiveRequests
  // -----------------------------------------------------------
  describe('logActiveRequests', () => {
    it('should not throw when no active requests', () => {
      expect(() => service.logActiveRequests()).not.toThrow();
    });

    it('should not throw when there are active requests', () => {
      service.trackRequest()(createMockReq(), createMockRes(), jest.fn());
      expect(() => service.logActiveRequests()).not.toThrow();
    });
  });

  // -----------------------------------------------------------
  // getStatistics
  // -----------------------------------------------------------
  describe('getStatistics', () => {
    it('should return zero stats when no requests are active', () => {
      const stats = service.getStatistics();
      expect(stats).toEqual({
        activeCount: 0,
        totalProcessed: 0,
        longestRunningMs: 0,
        averageDurationMs: 0,
      });
    });

    it('should return correct stats after tracking a request', () => {
      service.trackRequest()(createMockReq(), createMockRes(), jest.fn());
      const stats = service.getStatistics();

      expect(stats.activeCount).toBe(1);
      expect(stats.totalProcessed).toBe(1);
      expect(stats.longestRunningMs).toBeGreaterThanOrEqual(0);
      expect(stats.averageDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should track totalProcessed across multiple requests even after cleanup', () => {
      const res1 = createMockRes();
      const res2 = createMockRes();
      service.trackRequest()(createMockReq(), res1, jest.fn());
      service.trackRequest()(createMockReq(), res2, jest.fn());
      res1._emit('finish');

      const stats = service.getStatistics();
      expect(stats.activeCount).toBe(1);
      expect(stats.totalProcessed).toBe(2);
    });

    it('should compute longestRunningMs and averageDurationMs with multiple active requests', () => {
      const res1 = createMockRes();
      service.trackRequest()(createMockReq(), res1, jest.fn());
      const res2 = createMockRes();
      service.trackRequest()(createMockReq(), res2, jest.fn());

      const stats = service.getStatistics();
      expect(stats.activeCount).toBe(2);
      expect(stats.longestRunningMs).toBeGreaterThanOrEqual(0);
      expect(stats.averageDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // -----------------------------------------------------------
  // waitForActiveRequests
  // -----------------------------------------------------------
  describe('waitForActiveRequests', () => {
    it('should resolve immediately when there are no active requests', async () => {
      await expect(service.waitForActiveRequests(5000)).resolves.toBeUndefined();
    });

    it('should resolve after all active requests complete', async () => {
      const res = createMockRes();
      service.trackRequest()(createMockReq(), res, jest.fn());

      // Complete the request shortly after
      setTimeout(() => res._emit('finish'), 50);

      await expect(service.waitForActiveRequests(5000)).resolves.toBeUndefined();
      expect(service.getActiveRequestCount()).toBe(0);
    });

    it('should reject when timeout is exceeded', async () => {
      service.trackRequest()(createMockReq(), createMockRes(), jest.fn());

      await expect(service.waitForActiveRequests(100)).rejects.toThrow(
        /Timeout waiting for 1 active requests/,
      );
    });

    it('should reject with correct count when multiple requests remain', async () => {
      service.trackRequest()(createMockReq(), createMockRes(), jest.fn());
      service.trackRequest()(createMockReq(), createMockRes(), jest.fn());

      await expect(service.waitForActiveRequests(100)).rejects.toThrow(
        /Timeout waiting for 2 active requests/,
      );
    });
  });
});
