import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { ProfileCompletenessService } from '../profile-completeness/profile-completeness.service';
import { SearchService } from '../search/search.service';
import { CachingService } from './caching.service';
import { CACHE_TTL, CACHE_WARMING } from './caching.constants';
import {
  buildCourseListKey,
  buildPopularCoursesKey,
  buildSearchCacheKey,
  buildUserProfileKey,
} from './cache-key.builder';

export interface WarmResult {
  target: string;
  keysWarmed: number;
  durationMs: number;
}

/**
 * Preloads high-traffic cache entries before they are requested.
 */
@Injectable()
export class CacheWarmingService {
  private readonly logger = new Logger(CacheWarmingService.name);

  constructor(
    private readonly caching: CachingService,
    private readonly searchService: SearchService,
    private readonly profileCompleteness: ProfileCompletenessService,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async warmAll(): Promise<WarmResult[]> {
    return Promise.all([
      this.warmCoursesList(),
      this.warmPopularCourses(),
      this.warmSearchResults(),
      this.warmUserProfiles(),
    ]);
  }

  async warmCoursesList(): Promise<WarmResult> {
    const started = Date.now();
    const key = buildCourseListKey('published');
    const courses = await this.courseRepo.find({
      where: { status: CourseStatus.PUBLISHED },
      order: { createdAt: 'DESC' },
    });
    await this.caching.set(key, courses, CACHE_TTL.COURSE_METADATA);
    this.logger.log(`Warmed courses list (${courses.length} courses)`);
    return {
      target: 'COURSES_LIST',
      keysWarmed: 1,
      durationMs: Date.now() - started,
    };
  }

  async warmPopularCourses(): Promise<WarmResult> {
    const started = Date.now();
    const key = buildPopularCoursesKey();
    const popular = await this.enrollmentRepo
      .createQueryBuilder('enrollment')
      .select('enrollment.courseId', 'courseId')
      .addSelect('COUNT(enrollment.id)', 'enrollmentCount')
      .innerJoin('enrollment.course', 'course', 'course.status = :status', {
        status: CourseStatus.PUBLISHED,
      })
      .groupBy('enrollment.courseId')
      .orderBy('COUNT(enrollment.id)', 'DESC')
      .limit(CACHE_WARMING.POPULAR_COURSES_LIMIT)
      .getRawMany<{ courseId: string; enrollmentCount: string }>();

    let courses: Course[];
    if (popular.length === 0) {
      courses = await this.courseRepo.find({
        where: { status: CourseStatus.PUBLISHED },
        order: { createdAt: 'DESC' },
        take: CACHE_WARMING.POPULAR_COURSES_LIMIT,
      });
    } else {
      const courseIds = popular.map((row) => row.courseId);
      const fetched = await this.courseRepo.find({ where: { id: In(courseIds) } });
      const rank = new Map(courseIds.map((id, index) => [id, index]));
      courses = fetched.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    }

    await this.caching.set(key, courses, CACHE_TTL.POPULAR_COURSES);
    this.logger.log(`Warmed popular courses (${courses.length} courses)`);
    return {
      target: 'POPULAR_COURSES',
      keysWarmed: 1,
      durationMs: Date.now() - started,
    };
  }

  async warmSearchResults(): Promise<WarmResult> {
    const started = Date.now();
    let keysWarmed = 0;

    for (const query of CACHE_WARMING.SEARCH_WARM_QUERIES) {
      const result = await this.searchService.search(query);
      const key = buildSearchCacheKey(query);
      await this.caching.set(key, result, CACHE_TTL.SEARCH_RESULTS);
      keysWarmed += 1;
    }

    const filtersKey = buildSearchCacheKey('', { level: 'beginner' });
    const filteredResult = await this.searchService.search('', { level: 'beginner' });
    await this.caching.set(filtersKey, filteredResult, CACHE_TTL.SEARCH_RESULTS);
    keysWarmed += 1;

    this.logger.log(`Warmed search results (${keysWarmed} keys)`);
    return {
      target: 'SEARCH_RESULTS',
      keysWarmed,
      durationMs: Date.now() - started,
    };
  }

  async warmUserProfiles(): Promise<WarmResult> {
    const started = Date.now();
    let users = await this.userRepo.find({
      where: { lastLoginAt: Not(IsNull()) },
      order: { lastLoginAt: 'DESC' },
      take: CACHE_WARMING.USER_PROFILE_WARM_LIMIT,
    });

    if (users.length === 0) {
      users = await this.userRepo.find({
        order: { updatedAt: 'DESC' },
        take: CACHE_WARMING.USER_PROFILE_WARM_LIMIT,
      });
    }

    await Promise.all(
      users.map(async (user) => {
        const profile = await this.profileCompleteness.getScore(user.id);
        const key = buildUserProfileKey(user.id);
        await this.caching.set(key, profile, CACHE_TTL.USER_PROFILE);
      }),
    );

    this.logger.log(`Warmed user profiles (${users.length} users)`);
    return {
      target: 'USER_PROFILE',
      keysWarmed: users.length,
      durationMs: Date.now() - started,
    };
  }
}
