import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheOptimizationService } from './cache-optimization.service';
import { CacheAnalyticsReport, CacheAnalyticsService, TTLRecommendation } from './cache-analytics.service';

jest.mock('../config/cache.config', () => ({
  getSharedRedisClient: jest.fn(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  })),
}));

function makeConfigService(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    CACHE_ADAPTIVE_TTL_ENABLED: true,
    CACHE_HIT_RATE_OPTIMIZATION_ENABLED: true,
    CACHE_MEMORY_OPTIMIZATION_ENABLED: true,
    CACHE_MIN_HIT_RATE_THRESHOLD: 0.6,
    CACHE_MAX_MEMORY_THRESHOLD: 0.8,
    CACHE_OPTIMIZATION_INTERVAL_MINUTES: 60,
  };
  return {
    get: jest.fn((key: string, fallback?: unknown) => {
      const val = { ...defaults, ...overrides }[key];
      return val ?? fallback;
    }),
  };
}

function makeReport(overrides: Partial<CacheAnalyticsReport> = {}): CacheAnalyticsReport {
  return {
    totalKeys: 0,
    overallHitRate: 0,
    memoryUsage: 0,
    topPerformers: [],
    underPerformers: [],
    ttlRecommendations: [],
    adaptiveTtlAdjustments: 0,
    generatedAt: new Date(),
    ...overrides,
  };
}

describe('CacheOptimizationService', () => {
  let service: CacheOptimizationService;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let analyticsService: { getRecommendedTTL: jest.Mock; generateAnalyticsReport: jest.Mock };

  beforeEach(() => {
    cacheManager = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };
    eventEmitter = { emit: jest.fn() };
    analyticsService = {
      getRecommendedTTL: jest.fn().mockResolvedValue(300),
      generateAnalyticsReport: jest.fn().mockResolvedValue(makeReport()),
    };
    service = new CacheOptimizationService(
      cacheManager as never,
      makeConfigService() as never,
      eventEmitter as unknown as EventEmitter2,
      analyticsService as unknown as CacheAnalyticsService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── get ──────────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns cached value on hit and emits events', async () => {
      cacheManager.get.mockResolvedValueOnce('cached-data');

      const result = await service.get<string>('my-key');

      expect(result).toBe('cached-data');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.get',
        expect.objectContaining({ key: 'my-key', hit: true }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.performance',
        expect.objectContaining({ operation: 'get', key: 'my-key', hit: true }),
      );
    });

    it('returns undefined on cache miss', async () => {
      cacheManager.get.mockResolvedValueOnce(undefined);

      const result = await service.get<string>('missing-key');

      expect(result).toBeUndefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.get',
        expect.objectContaining({ key: 'missing-key', hit: false }),
      );
    });

    it('returns undefined on error and emits cache.error', async () => {
      cacheManager.get.mockRejectedValueOnce(new Error('redis down'));

      const result = await service.get<string>('fail-key');

      expect(result).toBeUndefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.error',
        expect.objectContaining({ operation: 'get', key: 'fail-key' }),
      );
    });
  });

  // ─── set ──────────────────────────────────────────────────────────────────

  describe('set', () => {
    it('sets value with default TTL when no ttl supplied', async () => {
      await service.set('cache:course:1', { name: 'Course 1' });

      expect(cacheManager.set).toHaveBeenCalledWith(
        'cache:course:1',
        { name: 'Course 1' },
        expect.any(Number),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.set',
        expect.objectContaining({ key: 'cache:course:1', size: expect.any(Number) }),
      );
    });

    it('uses adaptive TTL when enabled and ttl is supplied', async () => {
      analyticsService.getRecommendedTTL.mockResolvedValueOnce(600);

      await service.set('my-key', 'value', 300);

      expect(analyticsService.getRecommendedTTL).toHaveBeenCalledWith('my-key', 300);
      // finalTtl=600, so cacheManager.set gets 600*1000 ms
      expect(cacheManager.set).toHaveBeenCalledWith('my-key', 'value', 600_000);
    });

    it('uses provided TTL directly when adaptive TTL is disabled', async () => {
      service = new CacheOptimizationService(
        cacheManager as never,
        makeConfigService({ CACHE_ADAPTIVE_TTL_ENABLED: false }) as never,
        eventEmitter as unknown as EventEmitter2,
        analyticsService as unknown as CacheAnalyticsService,
      );

      await service.set('my-key', 'value', 120);

      expect(analyticsService.getRecommendedTTL).not.toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalledWith('my-key', 'value', 120_000);
    });

    it('uses default TTL for unknown prefix when no ttl supplied', async () => {
      await service.set('unknown-prefix:key', 'data');

      // Falls back to CACHE_TTL.COURSE_DETAILS = 300
      expect(cacheManager.set).toHaveBeenCalledWith('unknown-prefix:key', 'data', 300_000);
    });

    it('emits cache.error on cache-manager failure', async () => {
      cacheManager.set.mockRejectedValueOnce(new Error('set failed'));

      await service.set('bad-key', 'value');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.error',
        expect.objectContaining({ operation: 'set', key: 'bad-key' }),
      );
    });
  });

  // ─── del ──────────────────────────────────────────────────────────────────

  describe('del', () => {
    it('deletes key and emits cache.delete event', async () => {
      await service.del('my-key');

      expect(cacheManager.del).toHaveBeenCalledWith('my-key');
      expect(eventEmitter.emit).toHaveBeenCalledWith('cache.delete', { key: 'my-key' });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.performance',
        expect.objectContaining({ operation: 'delete', key: 'my-key' }),
      );
    });

    it('emits cache.error on failure', async () => {
      cacheManager.del.mockRejectedValueOnce(new Error('del failed'));

      await service.del('bad-key');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.error',
        expect.objectContaining({ operation: 'delete', key: 'bad-key' }),
      );
    });
  });

  // ─── optimizeCache ────────────────────────────────────────────────────────

  describe('optimizeCache', () => {
    it('applies TTL optimizations from high-confidence recommendations', async () => {
      const recommendations: TTLRecommendation[] = [
        {
          key: 'hot-key',
          currentTtl: 300,
          recommendedTtl: 450,
          reason: 'increase',
          confidence: 0.9,
          potentialSavings: 1024,
        },
        {
          key: 'low-conf-key',
          currentTtl: 300,
          recommendedTtl: 150,
          reason: 'decrease',
          confidence: 0.5,
          potentialSavings: 512,
        },
      ];
      analyticsService.generateAnalyticsReport.mockResolvedValueOnce(
        makeReport({ ttlRecommendations: recommendations }),
      );

      const result = await service.optimizeCache();

      // Only the high-confidence one (0.9 > 0.7) should be applied
      expect(result.optimizationsApplied).toBe(1);
      expect(result.memoryFreed).toBe(1024);
      expect(result.recommendations).toEqual(recommendations);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.ttl.updated',
        { key: 'hot-key', ttl: 450 },
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.optimization.completed',
        expect.any(Object),
      );
    });

    it('applies hit rate optimizations for low-hit-rate underperformers', async () => {
      const underPerformers = [
        {
          key: 'low-hit',
          hits: 5,
          misses: 95,
          hitRate: 0.05,
          avgTtl: 600,
          accessFrequency: 2,
          dataSize: 500,
          costScore: 0.1,
          lastAccessed: new Date(),
        },
        {
          key: 'mid-hit',
          hits: 40,
          misses: 60,
          hitRate: 0.4,
          avgTtl: 600,
          accessFrequency: 2,
          dataSize: 500,
          costScore: 0.3,
          lastAccessed: new Date(),
        },
      ];
      analyticsService.generateAnalyticsReport.mockResolvedValueOnce(
        makeReport({ underPerformers }),
      );

      const result = await service.optimizeCache();

      // mid-hit: avgTtl 600 > 300 → TTL reduced
      // low-hit: avgTtl 600 > 300 → TTL reduced, AND hitRate < 0.1 + freq < 0.5 → scheduled for removal
      expect(result.optimizationsApplied).toBeGreaterThanOrEqual(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.ttl.updated',
        expect.objectContaining({ key: 'mid-hit' }),
      );
    });

    it('applies memory optimizations for large low-performing keys', async () => {
      const underPerformers = [
        {
          key: 'big-slow',
          hits: 2,
          misses: 98,
          hitRate: 0.02,
          avgTtl: 300,
          accessFrequency: 1,
          dataSize: 2 * 1024 * 1024, // 2MB
          costScore: 0.05,
          lastAccessed: new Date(),
        },
      ];
      analyticsService.generateAnalyticsReport.mockResolvedValueOnce(
        makeReport({ underPerformers }),
      );

      const result = await service.optimizeCache();

      expect(result.memoryFreed).toBeGreaterThanOrEqual(2 * 1024 * 1024);
      expect(cacheManager.del).toHaveBeenCalledWith('big-slow');
    });

    it('respects disabled feature flags', async () => {
      service = new CacheOptimizationService(
        cacheManager as never,
        makeConfigService({
          CACHE_ADAPTIVE_TTL_ENABLED: false,
          CACHE_HIT_RATE_OPTIMIZATION_ENABLED: false,
          CACHE_MEMORY_OPTIMIZATION_ENABLED: false,
        }) as never,
        eventEmitter as unknown as EventEmitter2,
        analyticsService as unknown as CacheAnalyticsService,
      );
      analyticsService.generateAnalyticsReport.mockResolvedValueOnce(
        makeReport({
          ttlRecommendations: [
            {
              key: 'k',
              currentTtl: 100,
              recommendedTtl: 200,
              reason: 'r',
              confidence: 0.9,
              potentialSavings: 100,
            },
          ],
          underPerformers: [
            {
              key: 'low',
              hits: 1,
              misses: 99,
              hitRate: 0.01,
              avgTtl: 600,
              accessFrequency: 0.1,
              dataSize: 3 * 1024 * 1024,
              costScore: 0.01,
              lastAccessed: new Date(),
            },
          ],
        }),
      );

      const result = await service.optimizeCache();

      expect(result.optimizationsApplied).toBe(0);
      expect(result.memoryFreed).toBe(0);
      // No TTL updates or deletes when everything is disabled
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'cache.ttl.updated',
        expect.anything(),
      );
    });

    it('returns zero optimizations when no recommendations exist', async () => {
      const result = await service.optimizeCache();

      expect(result.optimizationsApplied).toBe(0);
      expect(result.memoryFreed).toBe(0);
      expect(result.hitRateImprovement).toBe(0);
      expect(result.recommendations).toEqual([]);
    });
  });

  // ─── getOptimizationConfig ────────────────────────────────────────────────

  describe('getOptimizationConfig', () => {
    it('returns a copy of the current config', () => {
      const config = service.getOptimizationConfig();

      expect(config.enableAdaptiveTtl).toBe(true);
      expect(config.enableHitRateOptimization).toBe(true);
      expect(config.enableMemoryOptimization).toBe(true);
      expect(config.minHitRateThreshold).toBe(0.6);
      expect(config.maxMemoryUsageThreshold).toBe(0.8);
      expect(config.optimizationInterval).toBe(60);
    });

    it('returns a copy, not a reference', () => {
      const config1 = service.getOptimizationConfig();
      const config2 = service.getOptimizationConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('reflects custom config overrides', () => {
      service = new CacheOptimizationService(
        cacheManager as never,
        makeConfigService({
          CACHE_ADAPTIVE_TTL_ENABLED: false,
          CACHE_MIN_HIT_RATE_THRESHOLD: 0.9,
        }) as never,
        eventEmitter as unknown as EventEmitter2,
        analyticsService as unknown as CacheAnalyticsService,
      );

      const config = service.getOptimizationConfig();
      expect(config.enableAdaptiveTtl).toBe(false);
      expect(config.minHitRateThreshold).toBe(0.9);
    });
  });

  // ─── updateOptimizationConfig ─────────────────────────────────────────────

  describe('updateOptimizationConfig', () => {
    it('updates config and emits cache.config.updated event', () => {
      service.updateOptimizationConfig({ enableAdaptiveTtl: false, optimizationInterval: 30 });

      const config = service.getOptimizationConfig();
      expect(config.enableAdaptiveTtl).toBe(false);
      expect(config.optimizationInterval).toBe(30);
      // Other values unchanged
      expect(config.enableHitRateOptimization).toBe(true);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'cache.config.updated',
        expect.objectContaining({ enableAdaptiveTtl: false, optimizationInterval: 30 }),
      );
    });

    it('preserves other config values when partial update', () => {
      service.updateOptimizationConfig({ minHitRateThreshold: 0.9 });

      const config = service.getOptimizationConfig();
      expect(config.minHitRateThreshold).toBe(0.9);
      expect(config.enableAdaptiveTtl).toBe(true);
      expect(config.maxMemoryUsageThreshold).toBe(0.8);
    });
  });

  // ─── getDefaultTTL (via set without ttl) ──────────────────────────────────

  describe('default TTL selection (via set)', () => {
    it('uses USER_PROFILE TTL for user profile keys', async () => {
      await service.set('cache:user:profile:123', { name: 'User' });
      expect(cacheManager.set).toHaveBeenCalledWith(
        'cache:user:profile:123',
        { name: 'User' },
        600_000, // CACHE_TTL.USER_PROFILE = 600
      );
    });

    it('uses SEARCH_RESULTS TTL for search keys', async () => {
      await service.set('cache:search:query', { results: [] });
      expect(cacheManager.set).toHaveBeenCalledWith(
        'cache:search:query',
        { results: [] },
        120_000, // CACHE_TTL.SEARCH_RESULTS = 120
      );
    });

    it('uses POPULAR_COURSES TTL for popular keys', async () => {
      await service.set('cache:popular:list', []);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'cache:popular:list',
        [],
        1800_000, // CACHE_TTL.POPULAR_COURSES = 1800
      );
    });

    it('uses ENROLLMENT_DATA TTL for enrollment keys', async () => {
      await service.set('cache:enrollment:123', { enrolled: true });
      expect(cacheManager.set).toHaveBeenCalledWith(
        'cache:enrollment:123',
        { enrolled: true },
        300_000, // CACHE_TTL.ENROLLMENT_DATA = 300
      );
    });

    it('uses COURSE_DETAILS TTL for course keys', async () => {
      await service.set('cache:course:42', { title: 'Course' });
      expect(cacheManager.set).toHaveBeenCalledWith(
        'cache:course:42',
        { title: 'Course' },
        300_000, // CACHE_TTL.COURSE_DETAILS = 300
      );
    });
  });
});
