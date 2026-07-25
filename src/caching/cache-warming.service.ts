import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { ProfileCompletenessService } from '../profile-completeness/profile-completeness.service';
import { SearchService } from '../search/search.service';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
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
 *
 * Key design decisions
 * ────────────────────
 * • Every DB read is capped by `CACHE_WARMING.MAX_ENTRIES` so an unbounded
 *   table never ends up fully in memory.
 * • Entries are selected by a *real signal* — enrollment count for courses,
 *   `lastLoginAt` recency for users — so the warmed set is the set most
 *   likely to be requested next.
 * • Profile warming processes users in configurable batches separated by a
 *   small async delay, bounding peak Redis write throughput and heap
 *   allocation per cycle.
 * • Each completed warming run is recorded to Prometheus via
 *   `MetricsCollectionService.recordCacheWarming`.
 */
@Injectable()
export class CacheWarmingService {
  private readonly logger = new Logger(CacheWarmingService.name);

  constructor(
    private readonly caching: CachingService,
    private readonly searchService: SearchService,
    private readonly profileCompleteness: ProfileCompletenessService,
    private readonly metrics: MetricsCollectionService,
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

  // ── Courses list ────────────────────────────────────────────────────────────

  async warmCoursesList(): Promise<WarmResult> {
    const started = Date.now();
    const key = buildCourseListKey('published');

    // Prioritise by enrollment count so the most popular courses fill the
    // list; fall back to recency when the enrollment table is empty.
    const topCourseIds = await this.enrollmentRepo
      .createQueryBuilder('enrollment')
      .select('enrollment.courseId', 'courseId')
      .addSelect('COUNT(enrollment.id)', 'cnt')
      .innerJoin('enrollment.course', 'course', 'course.status = :status', {
        status: CourseStatus.PUBLISHED,
      })
      .groupBy('enrollment.courseId')
      .orderBy('COUNT(enrollment.id)', 'DESC')
      .limit(CACHE_WARMING.MAX_ENTRIES)
      .getRawMany<{ courseId: string; cnt: string }>();

    let courses: Course[];
    if (topCourseIds.length > 0) {
      const ids = topCourseIds.map((r) => r.courseId);
      const fetched = await this.courseRepo.find({
        where: { id: In(ids), status: CourseStatus.PUBLISHED },
      });
      const rank = new Map(ids.map((id, i) => [id, i]));
      courses = fetched.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    } else {
      courses = await this.courseRepo.find({
        where: { status: CourseStatus.PUBLISHED },
        order: { createdAt: 'DESC' },
        take: CACHE_WARMING.MAX_ENTRIES,
      });
    }

    await this.caching.set(key, courses, CACHE_TTL.COURSE_METADATA);
    const durationMs = Date.now() - started;
    this.logger.log(`Warmed courses list (${courses.length} courses, ${durationMs}ms)`);
    this.metrics.recordCacheWarming('COURSES_LIST', 1, durationMs);
    return { target: 'COURSES_LIST', keysWarmed: 1, durationMs };
  }

  // ── Popular courses ─────────────────────────────────────────────────────────

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
      // Respect the configurable ceiling but never exceed the dedicated limit
      .limit(Math.min(CACHE_WARMING.POPULAR_COURSES_LIMIT, CACHE_WARMING.MAX_ENTRIES))
      .getRawMany<{ courseId: string; enrollmentCount: string }>();

    let courses: Course[];
    if (popular.length === 0) {
      courses = await this.courseRepo.find({
        where: { status: CourseStatus.PUBLISHED },
        order: { createdAt: 'DESC' },
        take: Math.min(CACHE_WARMING.POPULAR_COURSES_LIMIT, CACHE_WARMING.MAX_ENTRIES),
      });
    } else {
      const courseIds = popular.map((row) => row.courseId);
      const fetched = await this.courseRepo.find({ where: { id: In(courseIds) } });
      const rank = new Map(courseIds.map((id, index) => [id, index]));
      courses = fetched.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    }

    await this.caching.set(key, courses, CACHE_TTL.POPULAR_COURSES);
    const durationMs = Date.now() - started;
    this.logger.log(`Warmed popular courses (${courses.length} courses, ${durationMs}ms)`);
    this.metrics.recordCacheWarming('POPULAR_COURSES', 1, durationMs);
    return { target: 'POPULAR_COURSES', keysWarmed: 1, durationMs };
  }

  // ── Search results ──────────────────────────────────────────────────────────

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

    const durationMs = Date.now() - started;
    this.logger.log(`Warmed search results (${keysWarmed} keys, ${durationMs}ms)`);
    this.metrics.recordCacheWarming('SEARCH_RESULTS', keysWarmed, durationMs);
    return { target: 'SEARCH_RESULTS', keysWarmed, durationMs };
  }

  // ── User profiles ───────────────────────────────────────────────────────────

  /**
   * Warms profile-completeness scores for the most recently active users.
   *
   * Users are ranked by `lastLoginAt DESC` (real activity signal) and capped
   * by `CACHE_WARMING.MAX_ENTRIES`.  The working set is then processed in
   * fixed-size batches (`CACHE_WARMING.BATCH_SIZE`), with a short async delay
   * (`CACHE_WARMING.BATCH_DELAY_MS`) between batches.  This keeps peak Redis
   * write throughput and heap allocation bounded even when MAX_ENTRIES is
   * set very high.
   */
  async warmUserProfiles(): Promise<WarmResult> {
    const started = Date.now();

    // Prefer recently active users; fall back to recently updated rows when
    // no one has a non-null lastLoginAt (e.g. fresh installs, seed data).
    let users = await this.userRepo.find({
      where: { lastLoginAt: Not(IsNull()) },
      order: { lastLoginAt: 'DESC' },
      take: CACHE_WARMING.MAX_ENTRIES,
    });

    if (users.length === 0) {
      users = await this.userRepo.find({
        order: { updatedAt: 'DESC' },
        take: CACHE_WARMING.MAX_ENTRIES,
      });
    }

    let keysWarmed = 0;

    for (let i = 0; i < users.length; i += CACHE_WARMING.BATCH_SIZE) {
      const batch = users.slice(i, i + CACHE_WARMING.BATCH_SIZE);

      await Promise.all(
        batch.map(async (user) => {
          const profile = await this.profileCompleteness.getScore(user.id);
          const key = buildUserProfileKey(user.id);
          await this.caching.set(key, profile, CACHE_TTL.USER_PROFILE);
        }),
      );

      keysWarmed += batch.length;

      // Yield the event-loop between batches; skip the delay after the last one.
      if (i + CACHE_WARMING.BATCH_SIZE < users.length) {
        await this.delay(CACHE_WARMING.BATCH_DELAY_MS);
      }
    }

    const durationMs = Date.now() - started;
    this.logger.log(`Warmed user profiles (${keysWarmed} users, ${durationMs}ms)`);
    this.metrics.recordCacheWarming('USER_PROFILE', keysWarmed, durationMs);
    return { target: 'USER_PROFILE', keysWarmed, durationMs };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
