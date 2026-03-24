import { Test, TestingModule } from '@nestjs/testing';
import { CacheManagementController } from './cache-management.controller';
import { CachingService } from './caching.service';
import { CacheAnalyticsService } from './analytics/cache-analytics.service';
import { CacheInvalidationService } from './invalidation/invalidation.service';
import { CacheWarmingService } from './warming/cache-warming.service';
import { CacheStrategiesService } from './strategies/cache-strategies.service';

describe('CacheManagementController', () => {
  let controller: CacheManagementController;
  let cachingService: jest.Mocked<CachingService>;
  let analyticsService: jest.Mocked<CacheAnalyticsService>;
  let invalidationService: jest.Mocked<CacheInvalidationService>;
  let warmingService: jest.Mocked<CacheWarmingService>;
  let strategiesService: jest.Mocked<CacheStrategiesService>;

  beforeEach(async () => {
    const mockCachingService = {
      getStats: jest.fn(),
      get: jest.fn(),
      getTtl: jest.fn(),
      delPattern: jest.fn(),
      clearAll: jest.fn(),
      getTTLConstants: jest.fn(),
    };

    const mockAnalyticsService = {
      getSummary: jest.fn(),
      getAllMetrics: jest.fn(),
      getPrometheusMetrics: jest.fn(),
      resetMetrics: jest.fn(),
      resetPatternMetrics: jest.fn(),
    };

    const mockInvalidationService = {
      invalidateCourse: jest.fn(),
      invalidateUser: jest.fn(),
      invalidateSearch: jest.fn(),
      getStats: jest.fn(),
    };

    const mockWarmingService = {
      getStats: jest.fn(),
      getWarmedKeys: jest.fn(),
      refreshAll: jest.fn(),
    };

    const mockStrategiesService = {
      getAllStrategies: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CacheManagementController],
      providers: [
        {
          provide: CachingService,
          useValue: mockCachingService,
        },
        {
          provide: CacheAnalyticsService,
          useValue: mockAnalyticsService,
        },
        {
          provide: CacheInvalidationService,
          useValue: mockInvalidationService,
        },
        {
          provide: CacheWarmingService,
          useValue: mockWarmingService,
        },
        {
          provide: CacheStrategiesService,
          useValue: mockStrategiesService,
        },
      ],
    }).compile();

    controller = module.get<CacheManagementController>(CacheManagementController);
    cachingService = module.get(CachingService);
    analyticsService = module.get(CacheAnalyticsService);
    invalidationService = module.get(CacheInvalidationService);
    warmingService = module.get(CacheWarmingService);
    strategiesService = module.get(CacheStrategiesService);
  });

  describe('getStats', () => {
    it('should return combined stats', async () => {
      cachingService.getStats.mockResolvedValue({
        keys: 100,
        memory: '1.5M',
        hits: 1000,
        misses: 100,
      });
      analyticsService.getSummary.mockResolvedValue({
        totalHits: 1000,
        totalMisses: 100,
        hitRate: 90.91,
        missRate: 9.09,
        totalKeys: 100,
        memoryUsage: '1.5M',
        topKeys: [],
        patternStats: new Map(),
      });
      warmingService.getStats.mockReturnValue({
        totalKeys: 10,
        byType: { popular: 5 },
        lastWarmup: new Date(),
      });
      invalidationService.getStats.mockReturnValue({
        registeredTags: 5,
        totalTrackedKeys: 20,
      });

      const result = await controller.getStats();

      expect(result).toHaveProperty('redis');
      expect(result).toHaveProperty('analytics');
      expect(result).toHaveProperty('warming');
      expect(result).toHaveProperty('invalidation');
    });
  });

  describe('getAnalytics', () => {
    it('should return analytics', async () => {
      analyticsService.getSummary.mockResolvedValue({
        totalHits: 100,
        totalMisses: 10,
        hitRate: 90.91,
        missRate: 9.09,
        totalKeys: 50,
        memoryUsage: '1M',
        topKeys: [],
        patternStats: new Map([['cache:course:*', { hits: 50, misses: 5 }]]),
      });
      analyticsService.getAllMetrics.mockReturnValue([]);

      const result = await controller.getAnalytics();

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('patternStats');
    });
  });

  describe('getPrometheusMetrics', () => {
    it('should return prometheus metrics', () => {
      analyticsService.getPrometheusMetrics.mockReturnValue('# HELP cache_hits_total');

      const result = controller.getPrometheusMetrics();

      expect(result).toContain('cache_hits_total');
    });
  });

  describe('getStrategies', () => {
    it('should return strategies', () => {
      strategiesService.getAllStrategies.mockReturnValue([]);
      cachingService.getTTLConstants.mockReturnValue({} as any);

      const result = controller.getStrategies();

      expect(result).toHaveProperty('strategies');
      expect(result).toHaveProperty('ttlConstants');
    });
  });

  describe('getWarmedKeys', () => {
    it('should return warmed keys', () => {
      warmingService.getStats.mockReturnValue({
        totalKeys: 5,
        byType: {},
        lastWarmup: new Date(),
      });
      warmingService.getWarmedKeys.mockReturnValue([]);

      const result = controller.getWarmedKeys();

      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('keys');
    });
  });

  describe('getKey', () => {
    it('should return key value', async () => {
      cachingService.get.mockResolvedValue({ data: 'value' });
      cachingService.getTtl.mockResolvedValue(120);

      const result = await controller.getKey('test-key');

      expect(result.key).toBe('test-key');
      expect(result.value).toEqual({ data: 'value' });
      expect(result.exists).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should clear all cache', async () => {
      cachingService.clearAll.mockResolvedValue(100);

      await controller.clearAll();

      expect(cachingService.clearAll).toHaveBeenCalled();
    });
  });

  describe('clearByPattern', () => {
    it('should clear by pattern', async () => {
      cachingService.delPattern.mockResolvedValue(5);

      await controller.clearByPattern('course:*');

      expect(cachingService.delPattern).toHaveBeenCalledWith('cache:course:*');
    });
  });

  describe('invalidateCourse', () => {
    it('should invalidate course cache', async () => {
      invalidationService.invalidateCourse.mockResolvedValue([]);

      await controller.invalidateCourse('course-123');

      expect(invalidationService.invalidateCourse).toHaveBeenCalledWith('course-123');
    });
  });

  describe('invalidateUser', () => {
    it('should invalidate user cache', async () => {
      invalidationService.invalidateUser.mockResolvedValue([]);

      await controller.invalidateUser('user-123');

      expect(invalidationService.invalidateUser).toHaveBeenCalledWith('user-123');
    });
  });

  describe('invalidateSearch', () => {
    it('should invalidate search cache', async () => {
      invalidationService.invalidateSearch.mockResolvedValue([]);

      await controller.invalidateSearch();

      expect(invalidationService.invalidateSearch).toHaveBeenCalled();
    });
  });

  describe('warmCache', () => {
    it('should trigger cache warming', async () => {
      warmingService.refreshAll.mockResolvedValue(undefined);
      warmingService.getStats.mockReturnValue({
        totalKeys: 10,
        byType: {},
        lastWarmup: new Date(),
      });

      const result = await controller.warmCache();

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('stats');
    });
  });

  describe('resetAnalytics', () => {
    it('should reset all analytics', async () => {
      const result = await controller.resetAnalytics();

      expect(analyticsService.resetMetrics).toHaveBeenCalled();
      expect(result.message).toContain('All analytics reset');
    });

    it('should reset pattern analytics', async () => {
      const result = await controller.resetAnalytics('course:*');

      expect(analyticsService.resetPatternMetrics).toHaveBeenCalledWith('course:*');
      expect(result.message).toContain('course:*');
    });
  });
});
