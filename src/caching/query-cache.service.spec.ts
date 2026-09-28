import { QueryCacheService } from './query-cache.service';
import { CachingService } from './caching.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { CACHE_TTL, CACHE_PREFIXES } from './caching.constants';

describe('QueryCacheService', () => {
  let service: QueryCacheService;
  let cachingService: jest.Mocked<CachingService>;
  let invalidationService: jest.Mocked<CacheInvalidationService>;

  beforeEach(() => {
    cachingService = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue(undefined),
      getOrSet: jest.fn(),
      deleteByPattern: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn(),
      publishHitRateMetrics: jest.fn(),
      resetStats: jest.fn(),
    } as unknown as jest.Mocked<CachingService>;

    invalidationService = {
      invalidateKey: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
      invalidateCourseCache: jest.fn().mockResolvedValue(undefined),
      invalidateUserCache: jest.fn().mockResolvedValue(undefined),
      handleDataChange: jest.fn().mockResolvedValue(undefined),
      purgeAll: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CacheInvalidationService>;

    service = new QueryCacheService(cachingService, invalidationService);
  });

  describe('cacheQuery', () => {
    it('returns cached value on hit', async () => {
      cachingService.get.mockResolvedValue({ id: '1', name: 'cached' });
      const factory = jest.fn().mockResolvedValue({ id: '1', name: 'fresh' });

      const result = await service.cacheQuery('test:key', factory);

      expect(result).toEqual({ id: '1', name: 'cached' });
      expect(factory).not.toHaveBeenCalled();
    });

    it('calls factory and caches result on miss', async () => {
      cachingService.get.mockResolvedValue(undefined);
      const freshData = { id: '1', name: 'fresh' };
      const factory = jest.fn().mockResolvedValue(freshData);

      const result = await service.cacheQuery('test:key', factory, {
        ttlSeconds: CACHE_TTL.COURSE_DETAILS,
      });

      expect(result).toEqual(freshData);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cachingService.set).toHaveBeenCalledWith(
        'test:key',
        freshData,
        CACHE_TTL.COURSE_DETAILS,
      );
    });

    it('bypasses cache when bypassCache=true', async () => {
      const freshData = { id: '1', name: 'bypass-fresh' };
      const factory = jest.fn().mockResolvedValue(freshData);

      const result = await service.cacheQuery('test:key', factory, { bypassCache: true });

      expect(cachingService.get).not.toHaveBeenCalled();
      expect(result).toEqual(freshData);
    });
  });

  describe('domain-specific helpers', () => {
    const COURSE_ID = 'course-123';
    const USER_ID = 'user-456';

    beforeEach(() => {
      cachingService.get.mockResolvedValue(undefined);
    });

    it('getCourse uses COURSE_DETAILS TTL', async () => {
      const courseData = { id: COURSE_ID, title: 'Test Course' };
      await service.getCourse(COURSE_ID, async () => courseData);
      expect(cachingService.set).toHaveBeenCalledWith(
        expect.stringContaining(COURSE_ID),
        courseData,
        CACHE_TTL.COURSE_DETAILS,
      );
    });

    it('getCourseList uses COURSE_METADATA TTL', async () => {
      const courses = [{ id: '1' }, { id: '2' }];
      await service.getCourseList(async () => courses);
      expect(cachingService.set).toHaveBeenCalledWith(
        expect.stringContaining('courses:list'),
        courses,
        CACHE_TTL.COURSE_METADATA,
      );
    });

    it('getUserProfile uses USER_PROFILE TTL', async () => {
      const profile = { userId: USER_ID, completeness: 80 };
      await service.getUserProfile(USER_ID, async () => profile);
      expect(cachingService.set).toHaveBeenCalledWith(
        expect.stringContaining(USER_ID),
        profile,
        CACHE_TTL.USER_PROFILE,
      );
    });

    it('getSearchResults uses SEARCH_RESULTS TTL', async () => {
      const results = { hits: [], total: 0 };
      await service.getSearchResults('typescript', undefined, async () => results);
      expect(cachingService.set).toHaveBeenCalledWith(
        expect.stringContaining(`${CACHE_PREFIXES.SEARCH}`),
        results,
        CACHE_TTL.SEARCH_RESULTS,
      );
    });
  });

  describe('invalidation helpers', () => {
    it('invalidateCourse delegates to CacheInvalidationService', async () => {
      await service.invalidateCourse('course-1');
      expect(invalidationService.invalidateCourseCache).toHaveBeenCalledWith('course-1');
    });

    it('invalidateUser delegates to CacheInvalidationService', async () => {
      await service.invalidateUser('user-1');
      expect(invalidationService.invalidateUserCache).toHaveBeenCalledWith('user-1');
    });

    it('invalidateSearch delegates to CacheInvalidationService', async () => {
      await service.invalidateSearch();
      expect(invalidationService.invalidatePattern).toHaveBeenCalledWith(
        `${CACHE_PREFIXES.SEARCH}:*`,
      );
    });
  });

  describe('monitoring (getStats)', () => {
    it('returns zero stats before any operations', () => {
      const stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.invalidations).toBe(0);
    });

    it('increments hits on a cache hit', async () => {
      cachingService.get.mockResolvedValue({ data: true });
      await service.cacheQuery('k', async () => ({}));
      expect(service.getStats().hits).toBe(1);
      expect(service.getStats().misses).toBe(0);
    });

    it('increments misses on a cache miss', async () => {
      cachingService.get.mockResolvedValue(undefined);
      await service.cacheQuery('k', async () => ({}));
      expect(service.getStats().misses).toBe(1);
      expect(service.getStats().hits).toBe(0);
    });

    it('computes hit rate correctly', async () => {
      // 2 hits, 2 misses → 50% hit rate
      cachingService.get.mockResolvedValueOnce({ v: 1 });
      cachingService.get.mockResolvedValueOnce({ v: 2 });
      cachingService.get.mockResolvedValueOnce(undefined);
      cachingService.get.mockResolvedValueOnce(undefined);

      await service.cacheQuery('k1', async () => ({}));
      await service.cacheQuery('k2', async () => ({}));
      await service.cacheQuery('k3', async () => ({}));
      await service.cacheQuery('k4', async () => ({}));

      expect(service.getStats().hitRate).toBeCloseTo(50, 1);
    });

    it('increments invalidations counter on invalidate calls', async () => {
      await service.invalidateCourse('c1');
      await service.invalidateUser('u1');
      expect(service.getStats().invalidations).toBe(2);
    });

    it('resets stats via resetStats()', async () => {
      cachingService.get.mockResolvedValue({ v: 1 });
      await service.cacheQuery('k', async () => ({}));
      service.resetStats();
      expect(service.getStats().hits).toBe(0);
    });
  });
});
