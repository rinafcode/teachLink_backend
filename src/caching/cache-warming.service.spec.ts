import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { ProfileCompletenessService } from '../profile-completeness/profile-completeness.service';
import { SearchService } from '../search/search.service';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
import { IsolationService } from '../tenancy/isolation/isolation.service';
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
  let courseRepo: { find: jest.Mock; createQueryBuilder: jest.Mock };
  let enrollmentRepo: { createQueryBuilder: jest.Mock };
  let userRepo: { find: jest.Mock };
  let searchService: { search: jest.Mock };
  let profileCompleteness: { getScore: jest.Mock };
  let metrics: { recordCacheWarming: jest.Mock };
  let configStore: Record<string, unknown>;

  const makeCourseQb = (courses: unknown[]) => {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(courses),
    };
    return qb;
  };

  beforeEach(async () => {
    configStore = {};
    caching = {
      set: jest.fn().mockResolvedValue(undefined),
      getCurrentTenantId: jest.fn().mockReturnValue('tenant-a'),
    } as any;
    courseRepo = { find: jest.fn(), createQueryBuilder: jest.fn() };
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
        {
          provide: ProfileCompletenessService,
          useValue: profileCompleteness,
        },
        { provide: SearchService, useValue: searchService },
        {
          provide: IsolationService,
          useValue: { getTenantId: jest.fn().mockReturnValue('tenant-a') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) =>
              key in configStore ? configStore[key] : fallback,
            ),
          },
        },
        { provide: MetricsCollectionService, useValue: metrics },
        { provide: getRepositoryToken(Course), useValue: courseRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get(CacheWarmingService);
  });

  it('warms published course listings ranked by enrollment count', async () => {
    const courses = [{ id: 'c1', status: CourseStatus.PUBLISHED }];
    const qb = makeCourseQb(courses);
    courseRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.warmCoursesList();

    expect(result.target).toBe('COURSES_LIST');
    expect(qb.orderBy).toHaveBeenCalledWith('COUNT(enrollment.id)', 'DESC');
    // Bounded by the default max-entries cap.
    expect(qb.limit).toHaveBeenCalledWith(CACHE_WARMING.MAX_ENTRIES_DEFAULT);
    expect(caching.set).toHaveBeenCalledWith(
      buildCourseListKey('tenant-a', 'published'),
      courses,
      CACHE_TTL.COURSE_METADATA,
    );
    expect(metrics.recordCacheWarming).toHaveBeenCalledWith('COURSES_LIST', 1, expect.any(Number));
  });

  it('honours CACHE_WARM_MAX_ENTRIES when bounding the course listing read', async () => {
    configStore.CACHE_WARM_MAX_ENTRIES = 5;
    const qb = makeCourseQb([]);
    courseRepo.createQueryBuilder.mockReturnValue(qb);

    await service.warmCoursesList();

    expect(qb.limit).toHaveBeenCalledWith(5);
  });

  it('warms popular courses using enrollment counts', async () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ courseId: 'c1', enrollmentCount: '10' }]),
    };
    enrollmentRepo.createQueryBuilder.mockReturnValue(qb);
    courseRepo.find.mockResolvedValue([{ id: 'c1' }]);

    const result = await service.warmPopularCourses();

    expect(result.target).toBe('POPULAR_COURSES');
    // Popular list keeps its tighter product limit even under a larger global cap.
    expect(qb.limit).toHaveBeenCalledWith(CACHE_WARMING.POPULAR_COURSES_LIMIT);
    expect(courseRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ take: CACHE_WARMING.POPULAR_COURSES_LIMIT }),
    );
    expect(caching.set).toHaveBeenCalledWith(
      buildPopularCoursesKey('tenant-a'),
      [{ id: 'c1' }],
      CACHE_TTL.POPULAR_COURSES,
    );
  });

  it('warms search result keys for configured queries', async () => {
    const result = await service.warmSearchResults();

    expect(result.target).toBe('SEARCH_RESULTS');
    expect(result.keysWarmed).toBeGreaterThan(0);
    expect(searchService.search).toHaveBeenCalled();
    expect(caching.set).toHaveBeenCalledWith(
      buildSearchCacheKey('tenant-a', ''),
      expect.any(Object),
      CACHE_TTL.SEARCH_RESULTS,
    );
  });

  it('warms user profile scores for recently active users, bounded and in batches', async () => {
    userRepo.find.mockResolvedValue([{ id: 'u1' }]);

    const result = await service.warmUserProfiles();

    expect(result.target).toBe('USER_PROFILE');
    expect(userRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { lastLoginAt: 'DESC' },
        take: CACHE_WARMING.USER_PROFILE_WARM_LIMIT,
      }),
    );
    expect(profileCompleteness.getScore).toHaveBeenCalledWith('u1');
    expect(caching.set).toHaveBeenCalledWith(
      buildUserProfileKey('tenant-a', 'u1'),
      expect.objectContaining({ score: 80 }),
      CACHE_TTL.USER_PROFILE,
    );
    expect(metrics.recordCacheWarming).toHaveBeenCalledWith('USER_PROFILE', 1, expect.any(Number));
  });

  it('processes user profiles in bounded batches with a delay between them', async () => {
    configStore.CACHE_WARM_BATCH_SIZE = 2;
    configStore.CACHE_WARM_BATCH_DELAY_MS = 5;
    const users = Array.from({ length: 5 }, (_, i) => ({ id: `u${i}` }));
    userRepo.find.mockResolvedValue(users);
    const sleepSpy = jest
      .spyOn(service as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
      .mockResolvedValue(undefined);

    await service.warmUserProfiles();

    expect(profileCompleteness.getScore).toHaveBeenCalledTimes(5);
    // 5 items / batch size 2 => 3 batches => 2 inter-batch delays.
    expect(sleepSpy).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledWith(5);
  });
});
