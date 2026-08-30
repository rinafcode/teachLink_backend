import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheAnalyticsService, CacheMetrics, TTLRecommendation } from './cache-analytics.service';

jest.mock('../config/cache.config', () => ({
  getSharedRedisClient: jest.fn(() => mockRedis),
}));

let mockRedis: {
  hget: jest.Mock;
  hset: jest.Mock;
  hgetall: jest.Mock;
  hdel: jest.Mock;
  get: jest.Mock;
  incr: jest.Mock;
  incrby: jest.Mock;
  info: jest.Mock;
};

const freshMetrics = (): CacheMetrics => ({
  key: 'test-key',
  hits: 0,
  misses: 0,
  hitRate: 0,
  avgTtl: 0,
  lastAccessed: new Date(),
  accessFrequency: 0,
  dataSize: 0,
  costScore: 0,
});

function makeConfigService(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    CACHE_ADAPTIVE_TTL_ENABLED: true,
    CACHE_MIN_SAMPLE_SIZE: 100,
  };
  return {
    get: jest.fn((key: string, fallback?: unknown) => {
      const val = { ...defaults, ...overrides }[key];
      return val ?? fallback;
    }),
  };
}

describe('CacheAnalyticsService', () => {
  let service: CacheAnalyticsService;
  let eventEmitter: { emit: jest.Mock };
  let configService: ReturnType<typeof makeConfigService>;

  beforeEach(() => {
    mockRedis = {
      hget: jest.fn().mockResolvedValue(null),
      hset: jest.fn().mockResolvedValue(1),
      hgetall: jest.fn().mockResolvedValue({}),
      hdel: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
      incr: jest.fn().mockResolvedValue(1),
      incrby: jest.fn().mockResolvedValue(1),
      info: jest.fn().mockResolvedValue('used_memory:12345678'),
    };

    eventEmitter = { emit: jest.fn() };
    configService = makeConfigService();
    service = new CacheAnalyticsService(
      configService as never,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── recordHit ────────────────────────────────────────────────────────────

  describe('recordHit', () => {
    it('increments hit count and emits cache.hit event', async () => {
      await service.recordHit('my-key');

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'cache:analytics:metrics',
        'my-key',
        expect.any(String),
      );
      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.hits).toBe(1);
      expect(stored.misses).toBe(0);
      expect(stored.hitRate).toBe(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.hit',
        expect.objectContaining({ key: 'my-key' }),
      );
    });

    it('updates avgTtl when a ttl is supplied', async () => {
      await service.recordHit('my-key', 300);

      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.avgTtl).toBe(300);
    });

    it('computes a rolling avgTtl across multiple hits', async () => {
      // Simulate existing metrics with 1 hit and avgTtl 200
      mockRedis.hget.mockResolvedValueOnce(
        JSON.stringify({ ...freshMetrics(), hits: 1, avgTtl: 200 }),
      );

      await service.recordHit('my-key', 400);

      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.hits).toBe(2);
      // rolling avg: (200*1 + 400) / 2 = 300
      expect(stored.avgTtl).toBe(300);
    });

    it('does not change avgTtl when no ttl is supplied', async () => {
      mockRedis.hget.mockResolvedValueOnce(
        JSON.stringify({ ...freshMetrics(), hits: 3, avgTtl: 100 }),
      );

      await service.recordHit('my-key');

      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.avgTtl).toBe(100);
    });

    it('starts from zero metrics when no prior data exists', async () => {
      mockRedis.hget.mockResolvedValue(null);

      await service.recordHit('new-key');

      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.hits).toBe(1);
      expect(stored.misses).toBe(0);
    });

    it('treats corrupt existing metrics as a fresh start', async () => {
      mockRedis.hget.mockResolvedValueOnce('not-json');

      await service.recordHit('bad-key');

      expect(mockRedis.incr).toHaveBeenCalledWith('cache:metrics:deserialization_failures_total');
      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.hits).toBe(1);
    });

    it('treats metrics with missing fields as corrupt', async () => {
      mockRedis.hget.mockResolvedValueOnce(JSON.stringify({ key: 'x' }));

      await service.recordHit('bad-key');

      expect(mockRedis.incr).toHaveBeenCalledWith('cache:metrics:deserialization_failures_total');
    });

    it('silently ignores incr failure on corrupt metrics', async () => {
      mockRedis.hget.mockResolvedValueOnce('not-json');
      mockRedis.incr.mockRejectedValueOnce(new Error('redis down'));

      await expect(service.recordHit('bad-key')).resolves.toBeUndefined();
    });
  });

  // ─── recordMiss ───────────────────────────────────────────────────────────

  describe('recordMiss', () => {
    it('increments miss count and emits cache.miss event', async () => {
      await service.recordMiss('my-key');

      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.misses).toBe(1);
      expect(stored.hits).toBe(0);
      expect(stored.hitRate).toBe(0);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.miss',
        expect.objectContaining({ key: 'my-key' }),
      );
    });

    it('accumulates misses on top of existing metrics', async () => {
      mockRedis.hget.mockResolvedValueOnce(
        JSON.stringify({ ...freshMetrics(), misses: 5, hits: 10 }),
      );

      await service.recordMiss('my-key');

      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.misses).toBe(6);
      expect(stored.hitRate).toBeCloseTo(10 / 16);
    });

    it('starts from zero metrics when no prior data exists', async () => {
      mockRedis.hget.mockResolvedValue(null);

      await service.recordMiss('new-key');

      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.misses).toBe(1);
    });

    it('treats corrupt metrics as a fresh start', async () => {
      mockRedis.hget.mockResolvedValueOnce('not-json');

      await service.recordMiss('bad-key');

      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.misses).toBe(1);
      expect(mockRedis.incr).toHaveBeenCalledWith('cache:metrics:deserialization_failures_total');
    });
  });

  // ─── recordSet ────────────────────────────────────────────────────────────

  describe('recordSet', () => {
    it('sets avgTtl, dataSize, and emits cache.set event', async () => {
      await service.recordSet('my-key', 600, 2048);

      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.avgTtl).toBe(600);
      expect(stored.dataSize).toBe(2048);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.set',
        expect.objectContaining({ key: 'my-key', ttl: 600, dataSize: 2048 }),
      );
    });

    it('overwrites previous metrics on a new set', async () => {
      mockRedis.hget.mockResolvedValueOnce(
        JSON.stringify({ ...freshMetrics(), hits: 5, avgTtl: 100, dataSize: 1024 }),
      );

      await service.recordSet('my-key', 300, 4096);

      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.avgTtl).toBe(300);
      expect(stored.dataSize).toBe(4096);
      expect(stored.hits).toBe(5); // preserved
    });
  });

  // ─── getRecommendedTTL ────────────────────────────────────────────────────

  describe('getRecommendedTTL', () => {
    it('returns the stored recommended TTL for a key', async () => {
      mockRedis.hget.mockResolvedValueOnce('720');

      const ttl = await service.getRecommendedTTL('my-key', 300);

      expect(ttl).toBe(720);
      expect(mockRedis.hget).toHaveBeenCalledWith('cache:analytics:config', 'ttl:my-key');
    });

    it('returns the default TTL when no recommendation exists', async () => {
      mockRedis.hget.mockResolvedValueOnce(null);

      const ttl = await service.getRecommendedTTL('my-key', 300);

      expect(ttl).toBe(300);
    });

    it('returns the default TTL when the stored value is empty string', async () => {
      mockRedis.hget.mockResolvedValueOnce('');

      const ttl = await service.getRecommendedTTL('my-key', 120);

      expect(ttl).toBe(120);
    });
  });

  // ─── generateAnalyticsReport ──────────────────────────────────────────────

  describe('generateAnalyticsReport', () => {
    it('returns a report with zero keys and zero hit rate when no metrics exist', async () => {
      mockRedis.hgetall.mockResolvedValue({});
      mockRedis.info.mockResolvedValue('used_memory:0');
      mockRedis.get.mockResolvedValue(null);

      const report = await service.generateAnalyticsReport();

      expect(report.totalKeys).toBe(0);
      expect(report.overallHitRate).toBe(0);
      expect(report.memoryUsage).toBe(0);
      expect(report.topPerformers).toEqual([]);
      expect(report.underPerformers).toEqual([]);
      expect(report.ttlRecommendations).toEqual([]);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('calculates overall hit rate from multiple keys', async () => {
      const m1: CacheMetrics = {
        ...freshMetrics(),
        key: 'a',
        hits: 80,
        misses: 20,
        costScore: 0.5,
      };
      const m2: CacheMetrics = {
        ...freshMetrics(),
        key: 'b',
        hits: 10,
        misses: 90,
        costScore: 0.2,
      };
      mockRedis.hgetall.mockResolvedValue({
        a: JSON.stringify(m1),
        b: JSON.stringify(m2),
      });
      mockRedis.info.mockResolvedValue('used_memory:5000');
      mockRedis.get.mockResolvedValue('0');

      const report = await service.generateAnalyticsReport();

      expect(report.totalKeys).toBe(2);
      // total hits=90, total misses=110 → 90/200 = 0.45
      expect(report.overallHitRate).toBeCloseTo(0.45);
      expect(report.memoryUsage).toBe(5000);
    });

    it('sorts topPerformers by costScore descending and underPerformers ascending', async () => {
      const metrics: CacheMetrics[] = Array.from({ length: 15 }, (_, i) => ({
        ...freshMetrics(),
        key: `k${i}`,
        costScore: i,
      }));
      mockRedis.hgetall.mockResolvedValue(
        Object.fromEntries(metrics.map((m) => [m.key, JSON.stringify(m)])),
      );
      mockRedis.info.mockResolvedValue('used_memory:100');
      mockRedis.get.mockResolvedValue('0');

      const report = await service.generateAnalyticsReport();

      expect(report.topPerformers).toHaveLength(10);
      expect(report.topPerformers[0].key).toBe('k14'); // highest costScore
      expect(report.underPerformers).toHaveLength(10);
      // underPerformers are reversed (lowest first becomes first in array)
      expect(report.underPerformers[0].key).toBe('k0');
    });

    it('skips corrupt metrics entries gracefully', async () => {
      mockRedis.hgetall.mockResolvedValue({
        good: JSON.stringify({
          ...freshMetrics(),
          key: 'good',
          hits: 10,
          misses: 5,
          costScore: 0.5,
        }),
        bad: 'not-json',
        empty: JSON.stringify({ key: 'empty' }),
      });
      mockRedis.info.mockResolvedValue('used_memory:100');
      mockRedis.get.mockResolvedValue('0');

      const report = await service.generateAnalyticsReport();

      expect(report.totalKeys).toBe(1); // only the good one
      expect(mockRedis.incr).toHaveBeenCalledWith('cache:metrics:deserialization_failures_total');
    });

    it('returns 0 memory usage when redis.info fails', async () => {
      mockRedis.hgetall.mockResolvedValue({});
      mockRedis.info.mockRejectedValue(new Error('connection lost'));
      mockRedis.get.mockResolvedValue('0');

      const report = await service.generateAnalyticsReport();

      expect(report.memoryUsage).toBe(0);
    });

    it('returns 0 memoryUsage when info string has no used_memory', async () => {
      mockRedis.hgetall.mockResolvedValue({});
      mockRedis.info.mockResolvedValue('redis_version:7.0');
      mockRedis.get.mockResolvedValue('0');

      const report = await service.generateAnalyticsReport();

      expect(report.memoryUsage).toBe(0);
    });

    it('returns 0 for adaptiveTtlAdjustments when none stored', async () => {
      mockRedis.hgetall.mockResolvedValue({});
      mockRedis.info.mockResolvedValue('used_memory:0');
      mockRedis.get.mockResolvedValue(null);

      const report = await service.generateAnalyticsReport();

      expect(report.adaptiveTtlAdjustments).toBe(0);
    });

    it('parses adaptiveTtlAdjustments from redis', async () => {
      mockRedis.hgetall.mockResolvedValue({});
      mockRedis.info.mockResolvedValue('used_memory:0');
      mockRedis.get.mockResolvedValue('42');

      const report = await service.generateAnalyticsReport();

      expect(report.adaptiveTtlAdjustments).toBe(42);
    });

    it('generates TTL recommendations for keys with sufficient sample size', async () => {
      const metrics: CacheMetrics = {
        ...freshMetrics(),
        key: 'popular',
        hits: 200,
        misses: 10,
        hitRate: 200 / 210,
        avgTtl: 300,
        accessFrequency: 10,
        dataSize: 1024,
        costScore: 0.8,
      };
      mockRedis.hgetall.mockResolvedValue({ popular: JSON.stringify(metrics) });
      mockRedis.info.mockResolvedValue('used_memory:500');
      mockRedis.get.mockResolvedValue('0');

      const report = await service.generateAnalyticsReport();

      // hitRate > 0.8 && accessFrequency > 5 → recommends increase
      expect(report.ttlRecommendations.length).toBeGreaterThanOrEqual(1);
      const rec = report.ttlRecommendations.find((r) => r.key === 'popular')!;
      expect(rec.recommendedTtl).toBeGreaterThan(300);
    });

    it('skips TTL recommendations for keys below minSampleSize', async () => {
      const metrics: CacheMetrics = {
        ...freshMetrics(),
        key: 'rare',
        hits: 5,
        misses: 2,
        hitRate: 5 / 7,
        avgTtl: 300,
        accessFrequency: 10,
        dataSize: 1024,
        costScore: 0.8,
      };
      mockRedis.hgetall.mockResolvedValue({ rare: JSON.stringify(metrics) });
      mockRedis.info.mockResolvedValue('used_memory:500');
      mockRedis.get.mockResolvedValue('0');

      const report = await service.generateAnalyticsReport();

      expect(report.ttlRecommendations).toEqual([]);
    });
  });

  // ─── applyAdaptiveTTLAdjustments ──────────────────────────────────────────

  describe('applyAdaptiveTTLAdjustments', () => {
    it('skips adjustments when adaptiveTtl is disabled', async () => {
      configService = makeConfigService({ CACHE_ADAPTIVE_TTL_ENABLED: false });
      service = new CacheAnalyticsService(
        configService as never,
        eventEmitter as unknown as EventEmitter2,
      );

      await service.applyAdaptiveTTLAdjustments();

      expect(mockRedis.hgetall).not.toHaveBeenCalled();
      expect(mockRedis.incrby).not.toHaveBeenCalled();
    });

    it('applies high-confidence TTL adjustments and increments counter', async () => {
      const metrics: CacheMetrics = {
        ...freshMetrics(),
        key: 'hot',
        hits: 200,
        misses: 10,
        hitRate: 200 / 210,
        avgTtl: 300,
        accessFrequency: 10,
        dataSize: 1024,
        costScore: 0.8,
      };
      mockRedis.hgetall.mockResolvedValue({ hot: JSON.stringify(metrics) });
      mockRedis.get.mockResolvedValue('0');

      await service.applyAdaptiveTTLAdjustments();

      // TTL adjustment written to config
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'cache:analytics:config',
        'ttl:hot',
        expect.any(Number),
      );
      // Counter incremented
      expect(mockRedis.incrby).toHaveBeenCalledWith('cache:analytics:ttl_adjustments', 1);
      // Event emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.ttl.adjusted',
        expect.objectContaining({ key: 'hot' }),
      );
    });

    it('skips keys with insufficient sample size', async () => {
      const metrics: CacheMetrics = {
        ...freshMetrics(),
        key: 'cold',
        hits: 5,
        misses: 2,
        hitRate: 5 / 7,
        avgTtl: 300,
        accessFrequency: 10,
        dataSize: 1024,
        costScore: 0.8,
      };
      mockRedis.hgetall.mockResolvedValue({ cold: JSON.stringify(metrics) });
      mockRedis.get.mockResolvedValue('0');

      await service.applyAdaptiveTTLAdjustments();

      expect(mockRedis.hset).not.toHaveBeenCalledWith(
        'cache:analytics:config',
        'ttl:cold',
        expect.anything(),
      );
      expect(mockRedis.incrby).toHaveBeenCalledWith('cache:analytics:ttl_adjustments', 0);
    });

    it('skips low-confidence recommendations', async () => {
      // Metrics that produce a recommendation with confidence ≤ 0.7
      // low frequency (< 1) → confidence 0.7, not > 0.7, so it's skipped
      const metrics: CacheMetrics = {
        ...freshMetrics(),
        key: 'lowconf',
        hits: 150,
        misses: 50,
        hitRate: 0.75,
        avgTtl: 300,
        accessFrequency: 0.5,
        dataSize: 1024,
        costScore: 0.5,
      };
      mockRedis.hgetall.mockResolvedValue({ lowconf: JSON.stringify(metrics) });
      mockRedis.get.mockResolvedValue('0');

      await service.applyAdaptiveTTLAdjustments();

      // No TTL adjustment should be written for this key
      expect(mockRedis.hset).not.toHaveBeenCalled();
      expect(mockRedis.incrby).toHaveBeenCalledWith('cache:analytics:ttl_adjustments', 0);
    });
  });

  // ─── cleanupOldMetrics ────────────────────────────────────────────────────

  describe('cleanupOldMetrics', () => {
    it('runs cleanup without errors when no metrics exist', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      await expect(service.cleanupOldMetrics()).resolves.toBeUndefined();
    });

    it('keeps old metrics that have high sample count', async () => {
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const oldMetrics: CacheMetrics = {
        ...freshMetrics(),
        key: 'popular-old',
        lastAccessed: oldDate,
        hits: 200,
        misses: 50,
      };

      mockRedis.hgetall.mockResolvedValue({ 'popular-old': JSON.stringify(oldMetrics) });

      await service.cleanupOldMetrics();

      expect(mockRedis.hdel).not.toHaveBeenCalled();
    });

    it('does nothing when there are no metrics', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      await service.cleanupOldMetrics();

      expect(mockRedis.hdel).not.toHaveBeenCalled();
    });
  });

  // ─── handleCacheGet ───────────────────────────────────────────────────────

  describe('handleCacheGet', () => {
    it('delegates to recordHit when hit is true', async () => {
      await service.handleCacheGet({ key: 'k', hit: true, ttl: 120 });

      expect(mockRedis.hset).toHaveBeenCalled();
      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.hits).toBe(1);
      expect(stored.avgTtl).toBe(120);
    });

    it('delegates to recordMiss when hit is false', async () => {
      await service.handleCacheGet({ key: 'k', hit: false });

      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.misses).toBe(1);
    });
  });

  // ─── handleCacheSet ───────────────────────────────────────────────────────

  describe('handleCacheSet', () => {
    it('delegates to recordSet', async () => {
      await service.handleCacheSet({ key: 'k', ttl: 600, size: 4096 });

      const stored = JSON.parse(mockRedis.hset.mock.calls[0][2]) as CacheMetrics;
      expect(stored.avgTtl).toBe(600);
      expect(stored.dataSize).toBe(4096);
    });
  });

  // ─── cost score calculations (via recordHit + report) ─────────────────────

  describe('cost score', () => {
    it('ranks keys by costScore with high hit-rate and frequency scoring higher', async () => {
      const smallHot: CacheMetrics = {
        ...freshMetrics(),
        key: 'hot-small',
        hits: 200,
        misses: 10,
        hitRate: 200 / 210,
        accessFrequency: 15,
        dataSize: 100,
        avgTtl: 300,
        costScore: 0.3,
      };
      const largeCold: CacheMetrics = {
        ...freshMetrics(),
        key: 'cold-large',
        hits: 20,
        misses: 80,
        hitRate: 0.2,
        accessFrequency: 0.5,
        dataSize: 5 * 1024 * 1024,
        avgTtl: 60,
        costScore: 0.1,
      };
      mockRedis.hgetall.mockResolvedValue({
        'hot-small': JSON.stringify(smallHot),
        'cold-large': JSON.stringify(largeCold),
      });
      mockRedis.info.mockResolvedValue('used_memory:1000');
      mockRedis.get.mockResolvedValue('0');

      const report = await service.generateAnalyticsReport();

      expect(report.topPerformers[0].key).toBe('hot-small');
      expect(report.topPerformers[0].costScore).toBeGreaterThan(
        report.topPerformers.find((p) => p.key === 'cold-large')!.costScore,
      );
    });
  });

  // ─── TTL recommendation edge cases ────────────────────────────────────────

  describe('TTL recommendations', () => {
    const makeMetrics = (overrides: Partial<CacheMetrics> = {}): CacheMetrics => ({
      ...freshMetrics(),
      key: 'rec-key',
      hits: 200,
      misses: 10,
      hitRate: 200 / 210,
      avgTtl: 300,
      accessFrequency: 10,
      dataSize: 1024,
      costScore: 0.8,
      ...overrides,
    });

    it('recommends decreased TTL for low hit rate', async () => {
      const metrics = makeMetrics({
        hitRate: 0.2,
        accessFrequency: 10,
        avgTtl: 600,
        dataSize: 512,
      });
      mockRedis.hgetall.mockResolvedValue({ [metrics.key]: JSON.stringify(metrics) });
      mockRedis.info.mockResolvedValue('used_memory:100');
      mockRedis.get.mockResolvedValue('0');

      const report = await service.generateAnalyticsReport();

      const rec = report.ttlRecommendations.find((r) => r.key === 'rec-key');
      expect(rec).toBeDefined();
      expect(rec!.recommendedTtl).toBeLessThan(600);
    });

    it('returns no recommendation when TTL change is less than 20%', async () => {
      // high hit rate but accessFrequency is between 1 and 5, and dataSize is small
      // → no rule triggers a significant change
      const metrics = makeMetrics({
        hitRate: 0.7,
        accessFrequency: 3,
        avgTtl: 300,
        dataSize: 500,
      });
      mockRedis.hgetall.mockResolvedValue({ [metrics.key]: JSON.stringify(metrics) });
      mockRedis.info.mockResolvedValue('used_memory:100');
      mockRedis.get.mockResolvedValue('0');

      const report = await service.generateAnalyticsReport();

      expect(report.ttlRecommendations).toEqual([]);
    });

    it('does not recommend a TTL change for large objects when the change is exactly 20%', async () => {
      // large-object branch sets recommendedTtl = max(avgTtl*0.8, 120)
      // When avgTtl*0.8 > 120 the change is exactly 20%, which fails the >0.2 check
      const metrics = makeMetrics({
        hitRate: 0.5,
        accessFrequency: 3,
        avgTtl: 1200,
        dataSize: 2 * 1024 * 1024, // 2MB
      });
      mockRedis.hgetall.mockResolvedValue({ [metrics.key]: JSON.stringify(metrics) });
      mockRedis.info.mockResolvedValue('used_memory:100');
      mockRedis.get.mockResolvedValue('0');

      const report = await service.generateAnalyticsReport();

      // 0.8*1200=960, |960-1200|/1200 = 0.2 exactly → not > 0.2, so no rec
      const rec = report.ttlRecommendations.find((r) => r.key === 'rec-key');
      expect(rec).toBeUndefined();
    });

    it('recommends decreased TTL for a large object when avgTtl is very low', async () => {
      // When avgTtl is low enough that max(avgTtl*0.8, 120) = 120
      // the change can exceed 20%
      const metrics = makeMetrics({
        hitRate: 0.5,
        accessFrequency: 3,
        avgTtl: 50,
        dataSize: 2 * 1024 * 1024, // 2MB
      });
      mockRedis.hgetall.mockResolvedValue({ [metrics.key]: JSON.stringify(metrics) });
      mockRedis.info.mockResolvedValue('used_memory:100');
      mockRedis.get.mockResolvedValue('0');

      const report = await service.generateAnalyticsReport();

      const rec = report.ttlRecommendations.find((r) => r.key === 'rec-key');
      expect(rec).toBeDefined();
      expect(rec!.recommendedTtl).toBe(120); // Math.max(40, 120)
      expect(rec!.reason).toContain('Large object');
    });

    it('sorts recommendations by potentialSavings descending', async () => {
      const m1: CacheMetrics = makeMetrics({
        key: 'key-a',
        hitRate: 0.1,
        accessFrequency: 10,
        avgTtl: 600,
        dataSize: 500,
      });
      const m2: CacheMetrics = makeMetrics({
        key: 'key-b',
        hitRate: 0.1,
        accessFrequency: 10,
        avgTtl: 600,
        dataSize: 5000,
      });
      mockRedis.hgetall.mockResolvedValue({
        'key-a': JSON.stringify(m1),
        'key-b': JSON.stringify(m2),
      });
      mockRedis.info.mockResolvedValue('used_memory:100');
      mockRedis.get.mockResolvedValue('0');

      const report = await service.generateAnalyticsReport();

      expect(report.ttlRecommendations.length).toBeGreaterThanOrEqual(2);
      expect(report.ttlRecommendations[0].potentialSavings).toBeGreaterThanOrEqual(
        report.ttlRecommendations[1].potentialSavings,
      );
    });
  });
});
