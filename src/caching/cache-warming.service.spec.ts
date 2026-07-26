import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { ProfileCompletenessService } from '../profile-completeness/profile-completeness.service';
import { SearchService } from '../search/search.service';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
import { CachingService } from './caching.service';
import { CacheWarmingService } from './cache-warming.service';
import { CACHE_TTL, CACHE_WARMING } from './caching.constants';
import {
  buildCourseListKey,
  buildPopularCoursesKey,
  buildSearchCacheKey,
  buildUserProfileKey,
} from './cache-key.builder';

describe('CacheWarmingService', () => {
  let service: CacheWarmingService;
  let caching: jest.Mocked<Pick<CachingService, 'set'>>;
  let courseRepo: { find: jest.Mock };
  let enrollmentRepo: { createQueryBuilder: jest.Mock };
  let userRepo: { find: jest.Mock };
  let searchService: { search: jest.Mock };
  let profileCompleteness: { getScore: jest.Mock };
  let metrics: { recordCacheWarming: jest.Mock };

  /** Returns a fully-chained query-builder mock whose terminal call resolves to `rows`. */
  const mockQb = (rows: unknown[]) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  });

  beforeEach(async () => {
    caching = { set: jest.fn().mockResolvedValue(undefined) };
    courseRepo = { find: jest.fn() };
    enrollmentRepo = { createQueryBuilder: jest.fn() };
    userRepo = { find: jest.fn() };
    searchService = {
      search: jest.fn().mockResolvedValue({ results: [], total: 0, page: 1, limit: 20 }),
    };
    profileCompleteness = {
      getScore: jest.fn().mockResolvedValue({ score: 80, percentage: 80 }),
    };
    metrics = { recordCacheWarming: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheWarmingService,
        { provide: CachingService, useValue: caching },
        { provide: SearchService, useValue: searchService },
        { provide: ProfileCompletenessService, useValue: profileCompleteness },
        { provide: MetricsCollectionService, useValue: metrics },
        { provide: getRepositoryToken(Course), useValue: courseRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get(CacheWarmingService);
  });

  // ── warmCoursesList ─────────────────────────────────────────────────────────

  describe('warmCoursesList', () => {
    it('prioritises courses by enrollment count when enrollment data exists', async () => {
      enrollmentRepo.createQueryBuilder.mockReturnValue(
        mockQb([{ courseId: 'c1', cnt: '10' }, { courseId: 'c2', cnt: '5' }]),
      );
      const courses = [
        { id: 'c1', status: CourseStatus.PUBLISHED },
        { id: 'c2', status: CourseStatus.PUBLISHED },
      ];
      courseRepo.find.mockResolvedValue(courses);

      const result = await service.warmCoursesList();

      expect(result.target).toBe('COURSES_LIST');
      expect(result.keysWarmed).toBe(1);
      expect(caching.set).toHaveBeenCalledWith(
        buildCourseListKey('published'),
        expect.any(Array),
        CACHE_TTL.COURSE_METADATA,
      );
      expect(metrics.recordCacheWarming).toHaveBeenCalledWith(
        'COURSES_LIST',
        1,
        expect.any(Number),
      );
    });

    it('falls back to recency ordering when no enrollment data exists', async () => {
      enrollmentRepo.createQueryBuilder.mockReturnValue(mockQb([]));
      const courses = [{ id: 'c1', status: CourseStatus.PUBLISHED }];
      courseRepo.find.mockResolvedValue(courses);

      const result = await service.warmCoursesList();

      expect(result.target).toBe('COURSES_LIST');
      expect(courseRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
          take: CACHE_WARMING.MAX_ENTRIES,
        }),
      );
    });
  });

  // ── warmPopularCourses ──────────────────────────────────────────────────────

  describe('warmPopularCourses', () => {
    it('warms popular courses ranked by enrollment count', async () => {
      enrollmentRepo.createQueryBuilder.mockReturnValue(
        mockQb([{ courseId: 'c1', enrollmentCount: '10' }]),
      );
      courseRepo.find.mockResolvedValue([{ id: 'c1' }]);

      const result = await service.warmPopularCourses();

      expect(result.target).toBe('POPULAR_COURSES');
      expect(caching.set).toHaveBeenCalledWith(
        buildPopularCoursesKey(),
        [{ id: 'c1' }],
        CACHE_TTL.POPULAR_COURSES,
      );
      expect(metrics.recordCacheWarming).toHaveBeenCalledWith(
        'POPULAR_COURSES',
        1,
        expect.any(Number),
      );
    });

    it('falls back to recency when enrollment table is empty', async () => {
      enrollmentRepo.createQueryBuilder.mockReturnValue(mockQb([]));
      courseRepo.find.mockResolvedValue([{ id: 'c2' }]);

      const result = await service.warmPopularCourses();

      expect(result.target).toBe('POPULAR_COURSES');
      expect(courseRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: CourseStatus.PUBLISHED } }),
      );
    });
  });

  // ── warmSearchResults ───────────────────────────────────────────────────────

  describe('warmSearchResults', () => {
    it('warms all configured search queries and emits metrics', async () => {
      const result = await service.warmSearchResults();

      expect(result.target).toBe('SEARCH_RESULTS');
      expect(result.keysWarmed).toBeGreaterThan(0);
      expect(searchService.search).toHaveBeenCalled();
      expect(caching.set).toHaveBeenCalledWith(
        buildSearchCacheKey(''),
        expect.any(Object),
        CACHE_TTL.SEARCH_RESULTS,
      );
      expect(metrics.recordCacheWarming).toHaveBeenCalledWith(
        'SEARCH_RESULTS',
        result.keysWarmed,
        expect.any(Number),
      );
    });
  });

  // ── warmUserProfiles ────────────────────────────────────────────────────────

  describe('warmUserProfiles', () => {
    it('warms recently active users and emits metrics', async () => {
      userRepo.find.mockResolvedValue([{ id: 'u1' }]);

      const result = await service.warmUserProfiles();

      expect(result.target).toBe('USER_PROFILE');
      expect(result.keysWarmed).toBe(1);
      expect(profileCompleteness.getScore).toHaveBeenCalledWith('u1');
      expect(caching.set).toHaveBeenCalledWith(
        buildUserProfileKey('u1'),
        expect.objectContaining({ score: 80 }),
        CACHE_TTL.USER_PROFILE,
      );
      expect(metrics.recordCacheWarming).toHaveBeenCalledWith(
        'USER_PROFILE',
        1,
        expect.any(Number),
      );
    });

    it('falls back to updatedAt ordering when no user has a lastLoginAt', async () => {
      // First call (lastLoginAt query) returns empty; second call returns user
      userRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'u2' }]);

      const result = await service.warmUserProfiles();

      expect(result.keysWarmed).toBe(1);
      // Second find call should order by updatedAt
      expect(userRepo.find).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ order: { updatedAt: 'DESC' } }),
      );
    });

    it('processes users in batches respecting BATCH_SIZE', async () => {
      // Produce exactly BATCH_SIZE + 1 users so we exercise the inter-batch delay path
      const batchSize = CACHE_WARMING.BATCH_SIZE;
      const users = Array.from({ length: batchSize + 1 }, (_, i) => ({ id: `u${i}` }));
      userRepo.find.mockResolvedValue(users);

      // Spy on the private delay via jest fake timers
      jest.useFakeTimers();
      const resultPromise = service.warmUserProfiles();
      // Advance past inter-batch delay
      await jest.runAllTimersAsync();
      const result = await resultPromise;
      jest.useRealTimers();

      expect(result.keysWarmed).toBe(users.length);
      expect(profileCompleteness.getScore).toHaveBeenCalledTimes(users.length);
    });
  });
});
