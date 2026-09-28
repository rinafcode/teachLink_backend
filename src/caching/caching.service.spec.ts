import { CachingService, deriveCacheType, buildCounterKeys } from './caching.service';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
import { DistributedLockService } from '../orchestration/locks/distributed-lock.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    const re = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    const matches = Array.from(store.keys()).filter((k) => re.test(k));
    return ['0', matches] as [string, string[]];
  });
  return { store, incr, mget, scan, del };
}

const createLockServiceMock = () => {
  const held = new Map<string, string>();
  return {
    acquireLock: jest.fn(async (key: string, _ttl: number) => {
      if (held.has(key)) return null;
      const token = `token-${Math.random().toString(36).slice(2)}`;
      held.set(key, token);
      return token;
    }),
    releaseLock: jest.fn(async (key: string, token: string) => {
      if (held.get(key) === token) held.delete(key);
    }),
    held,
  };
};

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
  });

  // ── deriveCacheType / buildCounterKeys ──────────────────────────────────────

  describe('deriveCacheType', () => {
    it('returns the second segment for cache:{type}:... keys and the third for tenant-scoped keys', () => {
      expect(deriveCacheType('cache:test:1')).toBe('test');
      expect(deriveCacheType('cache:user:42')).toBe('user');
      expect(deriveCacheType('cache:course:popular')).toBe('course');
      expect(deriveCacheType('cache:tenant-a:course:popular')).toBe('course');
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

  // ── Single-process fallback (no upstream Redis injected) ──────────────────

  describe('without an injected DistributedLockService (single-process fallback)', () => {
    beforeEach(() => {
      redis = createMockRedis();
      service = new CachingService(
        cacheManager as never,
        metrics as unknown as MetricsCollectionService,
        undefined,
        redis as never,
      );
    });

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
      expect(cacheManager.set).toHaveBeenCalledWith('cache:tenant-a:test:2', { id: '2' }, 120000);
      expect(redis.incr).toHaveBeenCalledWith('cache:misses:test');

      const stats = await service.getStats('test');
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
    });

    describe('deleteByPattern', () => {
      it('uses store.keys to delete matching keys when client scan is unavailable', async () => {
        await service.deleteByPattern('cache:test:*');
        expect((cacheManager as any).store.keys).toHaveBeenCalledWith('cache:test:*');
        expect(cacheManager.del).toHaveBeenCalledWith('cache:test:1');
        expect(cacheManager.del).toHaveBeenCalledWith('cache:test:2');
      });
    });

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

      it('uses literal cache:hits:{type} / cache:misses:{type} keys', async () => {
        cacheManager.get.mockResolvedValueOnce('cached').mockResolvedValueOnce(undefined);
        await service.get('hit-key');
        await service.get('miss-key');

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

    describe('fallback behaviour when Redis is unavailable', () => {
      it('falls back to local counters and still reports stats', async () => {
        const brokenMget = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
        const brokenIncr = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

        const localOnly = new CachingService(
          cacheManager as never,
          metrics as unknown as MetricsCollectionService,
          {
            get: (key: string, fallback?: any) =>
              key === 'CACHE_COUNTER_FALLBACK_LOCAL' ? true : fallback,
          } as any,
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
          {
            get: (key: string, fallback?: any) =>
              key === 'CACHE_COUNTER_FALLBACK_LOCAL' ? false : fallback,
          } as any,
          { incr: brokenIncr, mget: brokenMget, scan: jest.fn(), del: jest.fn() } as never,
        );

        await expect(noFallback.getStats('application')).rejects.toThrow('ECONNREFUSED');
      });
    });
  });

  // ── Issue #812 thundering-herd protection ──────────────────────────────────

  describe('with an injected DistributedLockService (thundering-herd protection)', () => {
    let lockService: ReturnType<typeof createLockServiceMock>;

    beforeEach(() => {
      lockService = createLockServiceMock();
      redis = createMockRedis();
      service = new CachingService(
        cacheManager as never,
        metrics as unknown as MetricsCollectionService,
        undefined,
        redis as never,
        lockService as unknown as DistributedLockService,
      );
    });

    it('acquires the lock, only one caller runs the factory, and the lock is released', async () => {
      let firstRead = true;
      cacheManager.get.mockImplementation(async () => {
        if (firstRead) {
          firstRead = false;
          return undefined;
        }
        return { id: '42' };
      });
      const factory = jest.fn(async () => ({ id: '42' }));

      const result = await service.getOrSet('cache:hot:1', factory, 60);

      expect(result).toEqual({ id: '42' });
      expect(lockService.acquireLock).toHaveBeenCalledWith('cache:lock:cache:hot:1', 60_000);
      expect(lockService.releaseLock).toHaveBeenCalledWith(
        'cache:lock:cache:hot:1',
        expect.any(String),
      );
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cacheManager.set).toHaveBeenCalledWith('cache:hot:1', { id: '42' }, 60_000);
    });

    it('contended caller waits for the lock-holder to populate the cache and never invokes the factory', async () => {
      lockService.acquireLock.mockResolvedValueOnce(null);
      // Initial polled re-reads miss, then the cache fills.
      cacheManager.get
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ id: '100' });

      const factory = jest.fn();

      const result = await service.getOrSet('cache:hot:2', factory, 30);

      expect(result).toEqual({ id: '100' });
      expect(factory).not.toHaveBeenCalled();
      // After the contended caller observes the value, the stats reflect one
      // initial miss + one hit on the contended path.
      const stats = await service.getStats('hot');
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(1);
      // And the local factory must not have written into the cache either.
      expect(cacheManager.set).not.toHaveBeenCalled();
    }, 15_000);

    it('falls back to local factory computation when the lock never resolves', async () => {
      // Lock contention forever.
      lockService.acquireLock.mockResolvedValue(null);
      // CacheManager polls never produce a value within the lock TTL window.
      cacheManager.get.mockResolvedValue(undefined);

      const factory = jest.fn().mockResolvedValue({ id: 'fallback' });

      const result = await service.getOrSet('cache:hot:3', factory, 1);

      expect(result).toEqual({ id: 'fallback' });
      // Local write so subsequent requests avoid the fallback path.
      expect(cacheManager.set).toHaveBeenCalledWith('cache:hot:3', { id: 'fallback' }, 1_000);
      expect(factory).toHaveBeenCalledTimes(1);
    }, 15_000);

    it('still releases the lock even if the factory throws', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      const factory = jest.fn(async () => {
        throw new Error('upstream failure');
      });

      await expect(service.getOrSet('cache:hot:4', factory, 60)).rejects.toThrow(
        'upstream failure',
      );

      expect(lockService.acquireLock).toHaveBeenCalled();
      expect(lockService.releaseLock).toHaveBeenCalled();
    });
  });
});
