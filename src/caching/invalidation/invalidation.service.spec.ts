import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheInvalidationService } from './invalidation.service';
import { CachingService } from '../caching.service';
import { CacheStrategiesService } from '../strategies/cache-strategies.service';
import { CACHE_EVENTS } from '../caching.constants';

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let cachingService: jest.Mocked<CachingService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockCachingService = {
      delPattern: jest.fn(),
      del: jest.fn(),
      clearAll: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInvalidationService,
        CacheStrategiesService,
        {
          provide: CachingService,
          useValue: mockCachingService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<CacheInvalidationService>(CacheInvalidationService);
    cachingService = module.get(CachingService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('invalidateByPattern', () => {
    it('should invalidate by pattern', async () => {
      cachingService.delPattern.mockResolvedValue(5);

      const result = await service.invalidateByPattern('cache:course:*');

      expect(result.pattern).toBe('cache:course:*');
      expect(result.keysDeleted).toBe(5);
      expect(cachingService.delPattern).toHaveBeenCalledWith('cache:course:*');
    });
  });

  describe('invalidateByPatterns', () => {
    it('should invalidate multiple patterns', async () => {
      cachingService.delPattern.mockResolvedValue(3);

      const results = await service.invalidateByPatterns(['cache:course:*', 'cache:user:*']);

      expect(results).toHaveLength(2);
      expect(cachingService.delPattern).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateByTag', () => {
    it('should invalidate by tag', async () => {
      service.registerKeyWithTag('courses', 'cache:course:1');
      service.registerKeyWithTag('courses', 'cache:course:2');

      const result = await service.invalidateByTag('courses');

      expect(result).toBe(2);
      expect(cachingService.del).toHaveBeenCalledTimes(2);
    });

    it('should return 0 for non-existent tag', async () => {
      const result = await service.invalidateByTag('nonexistent');

      expect(result).toBe(0);
    });
  });

  describe('registerKeyWithTag', () => {
    it('should register key with tag', () => {
      service.registerKeyWithTag('courses', 'cache:course:1');

      const stats = service.getStats();
      expect(stats.registeredTags).toBe(1);
      expect(stats.totalTrackedKeys).toBe(1);
    });
  });

  describe('unregisterKeyFromTag', () => {
    it('should unregister key from tag', () => {
      service.registerKeyWithTag('courses', 'cache:course:1');
      service.unregisterKeyFromTag('courses', 'cache:course:1');

      const stats = service.getStats();
      expect(stats.totalTrackedKeys).toBe(0);
    });
  });

  describe('invalidateCourse', () => {
    it('should invalidate course cache', async () => {
      cachingService.delPattern.mockResolvedValue(5);

      const results = await service.invalidateCourse('course-123');

      expect(results.length).toBeGreaterThan(0);
      expect(eventEmitter.emit).toHaveBeenCalledWith(CACHE_EVENTS.COURSE_UPDATED, {
        courseId: 'course-123',
      });
    });
  });

  describe('invalidateUser', () => {
    it('should invalidate user cache', async () => {
      cachingService.delPattern.mockResolvedValue(3);

      const results = await service.invalidateUser('user-123');

      expect(results.length).toBeGreaterThan(0);
      expect(eventEmitter.emit).toHaveBeenCalledWith(CACHE_EVENTS.USER_UPDATED, {
        userId: 'user-123',
      });
    });
  });

  describe('invalidateEnrollment', () => {
    it('should invalidate enrollment cache', async () => {
      cachingService.delPattern.mockResolvedValue(2);

      const results = await service.invalidateEnrollment('enroll-123', 'course-123');

      expect(results.length).toBeGreaterThan(0);
      expect(eventEmitter.emit).toHaveBeenCalledWith(CACHE_EVENTS.ENROLLMENT_UPDATED, {
        enrollmentId: 'enroll-123',
        courseId: 'course-123',
      });
    });
  });

  describe('invalidateSearch', () => {
    it('should invalidate search cache', async () => {
      cachingService.delPattern.mockResolvedValue(10);

      const results = await service.invalidateSearch();

      expect(results.length).toBeGreaterThan(0);
      expect(eventEmitter.emit).toHaveBeenCalledWith(CACHE_EVENTS.SEARCH_INDEX_UPDATED);
    });
  });

  describe('clearAll', () => {
    it('should clear all cache', async () => {
      cachingService.clearAll.mockResolvedValue(100);

      const result = await service.clearAll();

      expect(result).toBe(100);
      expect(cachingService.clearAll).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return stats', () => {
      service.registerKeyWithTag('tag1', 'key1');
      service.registerKeyWithTag('tag1', 'key2');
      service.registerKeyWithTag('tag2', 'key3');

      const stats = service.getStats();

      expect(stats.registeredTags).toBe(2);
      expect(stats.totalTrackedKeys).toBe(3);
    });
  });
});
