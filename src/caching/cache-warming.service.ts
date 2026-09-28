import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { ProfileCompletenessService } from '../profile-completeness/profile-completeness.service';
import { SearchService } from '../search/search.service';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
import { CachingService } from './caching.service';
import {
  CACHE_TTL,
  CACHE_WARMING,
  CACHE_WARM_BATCH_DELAY_MS_ENV,
  CACHE_WARM_BATCH_SIZE_ENV,
  CACHE_WARM_MAX_ENTRIES_ENV,
} from './caching.constants';
import { IsolationService } from '../tenancy/isolation/isolation.service';
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
 * All repository reads are bounded by `CACHE_WARM_MAX_ENTRIES` (env/ConfigService,
 * default {@link CACHE_WARMING.MAX_ENTRIES_DEFAULT}) so warming never loads whole
 * courses/users tables into memory. The warmed set is prioritised by a real
 * signal — courses by enrollment count, users by recent activity — and processed
 * in batches with a short delay between them to bound DB/memory pressure. Every
 * pass exports its entry count and duration as Prometheus metrics.
 */
@Injectable()
export class CacheWarmingService {
  private readonly logger = new Logger(CacheWarmingService.name);

  constructor(
    private readonly caching: CachingService,
    private readonly isolationService: IsolationService,
    private readonly searchService: SearchService,
    private readonly profileCompleteness: ProfileCompletenessService,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly metrics?: MetricsCollectionService,
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
    const tenantId = this.caching.getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for tenant-scoped cache warmup');
    }
    const key = buildCourseListKey(tenantId, 'published');
    // Priority signal: most-enrolled published courses first (createdAt as a
    // stable tie-breaker), bounded so we never scan the whole courses table.
    const courses = await this.courseRepo
      .createQueryBuilder('course')
      .leftJoin('course.enrollments', 'enrollment')
      .where('course.status = :status', { status: CourseStatus.PUBLISHED })
      .groupBy('course.id')
      .orderBy('COUNT(enrollment.id)', 'DESC')
      .addOrderBy('course.createdAt', 'DESC')
      .limit(this.resolveMaxEntries())
      .getMany();
    await this.caching.set(key, courses, CACHE_TTL.COURSE_METADATA);
    return this.report('COURSES_LIST', 1, started, `${courses.length} courses`);
  }

  async warmPopularCourses(): Promise<WarmResult> {
    const started = Date.now();
    const tenantId = this.isolationService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for tenant-scoped cache warmup');
    }
    const maxEntries = this.resolveMaxEntries(CACHE_WARMING.POPULAR_COURSES_LIMIT);
    const key = buildPopularCoursesKey(tenantId);
    const popular = await this.enrollmentRepo
      .createQueryBuilder('enrollment')
      .select('enrollment.courseId', 'courseId')
      .addSelect('COUNT(enrollment.id)', 'enrollmentCount')
      .innerJoin('enrollment.course', 'course', 'course.status = :status', {
        status: CourseStatus.PUBLISHED,
      })
      .groupBy('enrollment.courseId')
      .orderBy('COUNT(enrollment.id)', 'DESC')
      .limit(maxEntries)
      .getRawMany<{ courseId: string; enrollmentCount: string }>();

    let courses: Course[];
    if (popular.length === 0) {
      courses = await this.courseRepo.find({
        where: { status: CourseStatus.PUBLISHED },
        order: { createdAt: 'DESC' },
        take: maxEntries,
      });
    } else {
      const courseIds = popular.map((row) => row.courseId);
      const fetched = await this.courseRepo.find({
        where: { id: In(courseIds) },
        take: maxEntries,
      });
      const rank = new Map(courseIds.map((id, index) => [id, index]));
      courses = fetched.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    }

    await this.caching.set(key, courses, CACHE_TTL.POPULAR_COURSES);
    return this.report('POPULAR_COURSES', 1, started, `${courses.length} courses`);
  }

  async warmSearchResults(): Promise<WarmResult> {
    const started = Date.now();
    let keysWarmed = 0;

    const tenantId = this.isolationService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for tenant-scoped cache warmup');
    }

    for (const query of CACHE_WARMING.SEARCH_WARM_QUERIES) {
      const result = await this.searchService.search(query);
      const key = buildSearchCacheKey(tenantId, query);
      await this.caching.set(key, result, CACHE_TTL.SEARCH_RESULTS);
      keysWarmed += 1;
    }

    const filtersKey = buildSearchCacheKey(tenantId, '', { level: 'beginner' });
    const filteredResult = await this.searchService.search('', { level: 'beginner' });
    await this.caching.set(filtersKey, filteredResult, CACHE_TTL.SEARCH_RESULTS);
    keysWarmed += 1;

    return this.report('SEARCH_RESULTS', keysWarmed, started, `${keysWarmed} keys`);
  }

  async warmUserProfiles(): Promise<WarmResult> {
    const started = Date.now();
    const maxEntries = this.resolveMaxEntries(CACHE_WARMING.USER_PROFILE_WARM_LIMIT);
    // Priority signal: most-recently active users first.
    let users = await this.userRepo.find({
      where: { lastLoginAt: Not(IsNull()) },
      order: { lastLoginAt: 'DESC' },
      take: maxEntries,
    });

    if (users.length === 0) {
      users = await this.userRepo.find({
        order: { updatedAt: 'DESC' },
        take: maxEntries,
      });
    }

    const tenantId = this.isolationService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required for tenant-scoped cache warmup');
    }

    // Batch the per-user score computation so we don't fan out one query per
    // user simultaneously; a short delay between batches bounds DB/memory load.
    await this.processInBatches(users, async (user) => {
      const profile = await this.profileCompleteness.getScore(user.id);
      const key = buildUserProfileKey(tenantId, user.id);
      await this.caching.set(key, profile, CACHE_TTL.USER_PROFILE);
    });

    return this.report('USER_PROFILE', users.length, started, `${users.length} users`);
  }

  /**
   * Resolves the per-query warming cap from config/env, clamped to a positive
   * integer. A caller-supplied `fallback` (e.g. a target-specific limit) is used
   * when it is smaller than the global cap so existing tighter limits are kept.
   */
  private resolveMaxEntries(fallback?: number): number {
    const configured = this.readPositiveInt(
      CACHE_WARM_MAX_ENTRIES_ENV,
      CACHE_WARMING.MAX_ENTRIES_DEFAULT,
    );
    if (fallback !== undefined && fallback > 0) {
      return Math.min(configured, fallback);
    }
    return configured;
  }

  private resolveBatchSize(): number {
    return this.readPositiveInt(CACHE_WARM_BATCH_SIZE_ENV, CACHE_WARMING.BATCH_SIZE_DEFAULT);
  }

  private resolveBatchDelayMs(): number {
    const value = this.configService?.get<number | string>(CACHE_WARM_BATCH_DELAY_MS_ENV);
    const parsed = typeof value === 'string' ? parseInt(value, 10) : value;
    if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    return CACHE_WARMING.BATCH_DELAY_MS_DEFAULT;
  }

  private readPositiveInt(envKey: string, fallback: number): number {
    const value = this.configService?.get<number | string>(envKey);
    const parsed = typeof value === 'string' ? parseInt(value, 10) : value;
    if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
    return fallback;
  }

  private async processInBatches<T>(
    items: T[],
    handler: (item: T) => Promise<void>,
  ): Promise<void> {
    const batchSize = this.resolveBatchSize();
    const delayMs = this.resolveBatchDelayMs();
    for (let start = 0; start < items.length; start += batchSize) {
      const batch = items.slice(start, start + batchSize);
      await Promise.all(batch.map(handler));
      if (delayMs > 0 && start + batchSize < items.length) {
        await this.sleep(delayMs);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private report(target: string, keysWarmed: number, started: number, detail: string): WarmResult {
    const durationMs = Date.now() - started;
    this.metrics?.recordCacheWarming(target, keysWarmed, durationMs / 1000);
    this.logger.log(`Warmed ${target.toLowerCase()} (${detail}) in ${durationMs}ms`);
    return { target, keysWarmed, durationMs };
  }
}
