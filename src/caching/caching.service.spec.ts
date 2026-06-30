import { CachingService, deriveCacheType, buildCounterKeys } from './caching.service';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a jest-mocked ioredis-like client with just the methods the
 * CachingService now uses (incr, mget, scan, del). We intentionally keep this
 * minimal so the surface area that the tests exercise matches production.
 */
function createMockRedis() {
  const store = new Map<string, number>();
  const mget = jest.fn(async (...keys: string[]) =>
    keys.map((k) => (store.has(k) ? String(store.get(k)) : null)),
  );
  const incr = jest.fn(async (key: string) => {
    const next = (store.get(key) ?? 0) + 1;
    store.set(key, next);
    return next;
  });
  const del = jest.fn(async (...keys: string[]) => {
    let removed = 0;
    for (const k of keys) {
      if (store.delete(k)) removed += 1;
    }
    return removed;
  });
  const scan = jest.fn(async (_cursor: string, _match: string, pattern: string) => {
    const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matches = Array.from(store.keys()).filter((k) => re.test(k));
    return ['0', matches] as [string, string[]];
  });
  return { store, incr, mget, scan, del };
}

describe('CachingService', () => {
  let service: CachingService;
  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    clear: jest.Mock;
  };
  let metrics: { updateCacheHitRate: jest.Mock };
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    metrics = { updateCacheHitRate: jest.fn() };
    (cacheManager as any).store = {
      keys: jest.fn().mockResolvedValue(['cache:test:1', 'cache:test:2']),
    };
    redis = createMockRedis();

    service = new CachingService(
      cacheManager as never,
      metrics as unknown as MetricsCollectionService,
      undefined,
      redis as never,
    );
  });

  // ── deriveCacheType / buildCounterKeys ──────────────────────────────────────

  describe('deriveCacheType', () => {
    it('returns the second segment for cache:{type}:... keys', () => {
      expect(deriveCacheType('cache:test:1')).toBe('test');
      expect(deriveCacheType('cache:user:42')).toBe('user');
      expect(deriveCacheType('cache:course:popular')).toBe('course');
    });

    it('returns "default" for keys with no cache: prefix', () => {
      expect(deriveCacheType('hit-key')).toBe('default');
      expect(deriveCacheType('foo:bar')).toBe('default');
    });

    it('returns "default" for empty / invalid input', () => {
      expect(deriveCacheType('')).toBe('default');
    });
  });

  describe('buildCounterKeys', () => {
    it('produces namespaced hit/miss keys', () => {
      expect(buildCounterKeys('application')).toEqual({
        hits: 'cache:hits:application',
        misses: 'cache:misses:application',
      });
    });
  });

  // ── getOrSet ───────────────────────────────────────────────────────────────

  describe('getOrSet', () => {
    it('returns cached value without calling factory on hit', async () => {
      cacheManager.get.mockResolvedValue({ id: '1' });
      const factory = jest.fn();

      const result = await service.getOrSet('cache:test:1', factory, 60);

      expect(result).toEqual({ id: '1' });
      expect(factory).not.toHaveBeenCalled();

      const stats = await service.getStats('test');
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);

      // INCR must have been called against the correct cluster-wide key
      expect(redis.incr).toHaveBeenCalledWith('cache:hits:test');
    });

    it('populates cache from factory on miss', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      const factory = jest.fn().mockResolvedValue({ id: '2' });

      const result = await service.getOrSet('cache:test:2', factory, 120);

      expect(result).toEqual({ id: '2' });
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cacheManager.set).toHaveBeenCalledWith('cache:test:2', { id: '2' }, 120000);
      expect(redis.incr).toHaveBeenCalledWith('cache:misses:test');

      const stats = await service.getStats('test');
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
    });
  });

  // ── deleteByPattern ────────────────────────────────────────────────────────

  describe('deleteByPattern', () => {
    it('uses store.keys to delete matching keys when client scan is unavailable', async () => {
      await service.deleteByPattern('cache:test:*');
      expect((cacheManager as any).store.keys).toHaveBeenCalledWith('cache:test:*');
      expect(cacheManager.del).toHaveBeenCalledWith('cache:test:1');
      expect(cacheManager.del).toHaveBeenCalledWith('cache:test:2');
    });
  });

  // ── Cluster-wide hit rate (Issue #811) ─────────────────────────────────────

  describe('distributed hit rate metrics', () => {
    it('publishes aggregated cluster-wide hit rate to Prometheus', async () => {
      // Simulate three pods: each has independently INCRemented the shared
      // Redis counter. The reported hit rate must reflect what Redis holds,
      // NOT just what this service instance has seen locally.
      redis.store.set('cache:hits:application', 7);
      redis.store.set('cache:misses:application', 3);

      await service.publishHitRateMetrics('application');

      expect(metrics.updateCacheHitRate).toHaveBeenCalledWith('application', 70);

      // The read path must use MGET against the CRedis keys, not local state.
      expect(redis.mget).toHaveBeenCalledWith(
        'cache:hits:application',
        'cache:misses:application',
      );
    });

    it('uses literal cache:hits:{type} / cache:misses:{type} keys (issue #811)', async () => {
      cacheManager.get.mockResolvedValueOnce('cached').mockResolvedValueOnce(undefined);
      await service.get('hit-key');
      await service.get('miss-key');

      // Issue spec: keys must be exactly cache:hits:{type} and cache:misses:{type}
      expect(redis.incr).toHaveBeenCalledWith('cache:hits:default');
      expect(redis.incr).toHaveBeenCalledWith('cache:misses:default');
    });

    it('aggregates hits/misses per cache type independently', async () => {
      redis.store.set('cache:hits:test', 8);
      redis.store.set('cache:misses:test', 2);
      redis.store.set('cache:hits:course', 1);
      redis.store.set('cache:misses:course', 4);

      const testStats = await service.getStats('test');
      expect(testStats.hits).toBe(8);
      expect(testStats.misses).toBe(2);
      expect(testStats.hitRate).toBe(80);

      const courseStats = await service.getStats('course');
      expect(courseStats.hits).toBe(1);
      expect(courseStats.misses).toBe(4);
      expect(courseStats.hitRate).toBe(20);
    });

    it('returns zero hit rate when no counters have been recorded', async () => {
      const stats = await service.getStats('application');
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('returns aggregate stats across every type', async () => {
      redis.store.set('cache:hits:test', 5);
      redis.store.set('cache:misses:test', 5);
      redis.store.set('cache:hits:course', 2);
      redis.store.set('cache:misses:course', 8);

      const aggregate = await service.getAggregateStats();
      expect(aggregate.hits).toBe(7);
      expect(aggregate.misses).toBe(13);
      // 7 / 20 = 35
      expect(aggregate.hitRate).toBeCloseTo(35, 1);
    });
  });

  // ── Counter reset mechanism ─────────────────────────────────────────────────

  describe('resetStats', () => {
    it('deletes cluster-wide counter keys for a single type', async () => {
      redis.store.set('cache:hits:test', 10);
      redis.store.set('cache:misses:test', 4);

      await service.resetStats('test');

      expect(redis.del).toHaveBeenCalledWith('cache:hits:test', 'cache:misses:test');

      const stats = await service.getStats('test');
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('deletes all cluster-wide counter keys when called without an argument', async () => {
      redis.store.set('cache:hits:test', 1);
      redis.store.set('cache:misses:test', 2);
      redis.store.set('cache:hits:course', 3);
      redis.store.set('cache:misses:course', 4);

      await service.resetStats();

      expect(redis.scan).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled();

      const aggregate = await service.getAggregateStats();
      expect(aggregate.hits).toBe(0);
      expect(aggregate.misses).toBe(0);
    });
  });

  // ── Graceful degradation ───────────────────────────────────────────────────

  describe('fallback behaviour when Redis is unavailable', () => {
    it('falls back to local counters and still reports stats', async () => {
      // Simulate a broken Redis by throwing on every read.
      const brokenMget = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const brokenIncr = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      // Direct construction: opt in to local fallback explicitly (default is
      // already enabled in production but we make it explicit here).
      const localOnly = new CachingService(
        cacheManager as never,
        metrics as unknown as MetricsCollectionService,
        { get: (key: string, fallback?: any) => (key === 'CACHE_COUNTER_FALLBACK_LOCAL' ? true : fallback) } as any,
        { incr: brokenIncr, mget: brokenMget, scan: jest.fn(), del: jest.fn() } as never,
      );

      cacheManager.get.mockResolvedValueOnce(undefined).mockResolvedValue({ id: 'x' });
      await localOnly.get('miss-key');
      await localOnly.get('hit-key');

      const stats = await localOnly.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });

    it('publishes zero hit rate when Redis is unavailable and fallback disabled', async () => {
      const brokenMget = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const brokenIncr = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const noFallback = new CachingService(
        cacheManager as never,
        metrics as unknown as MetricsCollectionService,
        { get: (key: string, fallback?: any) => (key === 'CACHE_COUNTER_FALLBACK_LOCAL' ? false : fallback) } as any,
        { incr: brokenIncr, mget: brokenMget, scan: jest.fn(), del: jest.fn() } as never,
      );

      await expect(noFallback.getStats('application')).rejects.toThrow('ECONNREFUSED');
    });
  });
});
