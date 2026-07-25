import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { ProfileCompletenessService } from '../profile-completeness/profile-completeness.service';
import { SearchService } from '../search/search.service';
import { CachingService } from './caching.service';
import { CacheWarmingService } from './cache-warming.service';
import { CACHE_TTL } from './caching.constants';
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheWarmingService,
        { provide: CachingService, useValue: caching },
        { provide: SearchService, useValue: searchService },
        { provide: ProfileCompletenessService, useValue: profileCompleteness },
        { provide: getRepositoryToken(Course), useValue: courseRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get(CacheWarmingService);
  });

  it('warms published course listings', async () => {
    const courses = [{ id: 'c1', status: CourseStatus.PUBLISHED }];
    courseRepo.find.mockResolvedValue(courses);

    const result = await service.warmCoursesList();

    expect(result.target).toBe('COURSES_LIST');
    expect(caching.set).toHaveBeenCalledWith(
      buildCourseListKey('published'),
      courses,
      CACHE_TTL.COURSE_METADATA,
    );
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
    expect(caching.set).toHaveBeenCalledWith(
      buildPopularCoursesKey(),
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
      buildSearchCacheKey(''),
      expect.any(Object),
      CACHE_TTL.SEARCH_RESULTS,
    );
  });

  it('warms user profile scores for recently active users', async () => {
    userRepo.find.mockResolvedValue([{ id: 'u1' }]);

    const result = await service.warmUserProfiles();

    expect(result.target).toBe('USER_PROFILE');
    expect(profileCompleteness.getScore).toHaveBeenCalledWith('u1');
    expect(caching.set).toHaveBeenCalledWith(
      buildUserProfileKey('u1'),
      expect.objectContaining({ score: 80 }),
      CACHE_TTL.USER_PROFILE,
    );
  });
});
