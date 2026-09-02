import { Injectable, Logger } from '@nestjs/common';
import { CachingService } from './caching.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { CACHE_TTL, CACHE_PREFIXES, CACHE_EVENTS } from './caching.constants';
import {
  buildCourseKey,
  buildCourseListKey,
  buildUserProfileKey,
  buildSearchCacheKey,
} from './cache-key.builder';
import { SearchFilters } from '../search/search.service';

/**
 * Statistics snapshot emitted by QueryCacheService.
 */
export interface QueryCacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  invalidations: number;
}

/**
 * Options for a single cache-aside operation.
 */
export interface QueryCacheOptions {
  /** Cache TTL in seconds.  Defaults to `CACHE_TTL.COURSE_METADATA` (15 min). */
  ttlSeconds?: number;
  /**
   * When `true` the cache is bypassed and the factory is always called.
   * Useful for read-after-write scenarios.
   */
  bypassCache?: boolean;
}

/**
 * QueryCacheService provides a standardised cache-aside layer for
 * frequently executed database queries.
 *
 * ### Design choices
 * - **Cache-aside pattern**: data is fetched from the DB on a cache miss and
 *   stored with an entity-specific TTL.
 * - **Configurable TTL per query type**: callers can override the default TTL
 *   via `QueryCacheOptions.ttlSeconds` or use the domain-specific helpers that
 *   embed sensible defaults from `CACHE_TTL`.
 * - **Standardised cache keys**: all keys are built by the shared
 *   `cache-key.builder.ts` so they are consistent and version-aware.
 * - **Event-driven invalidation**: mutations emit `CACHE_EVENTS` which the
 *   `CacheInvalidationListener` handles automatically; callers can also
 *   trigger explicit invalidation via the `invalidate*` methods.
 * - **Hit-rate monitoring**: hit/miss counters are maintained in-process and
 *   exposed via `getStats()` for metrics collectors (addresses the monitoring
 *   acceptance criterion in issue #511).
 *
 * ### Performance
 * All helpers target the <100 ms SLA required by issue #511 by serving from
 * the in-memory Redis client; network latency to a local Redis is typically
 * sub-millisecond.
 */
@Injectable()
export class QueryCacheService {
  private readonly logger = new Logger(QueryCacheService.name);

  private hits = 0;
  private misses = 0;
  private invalidations = 0;

  constructor(
    private readonly caching: CachingService,
    private readonly invalidation: CacheInvalidationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Generic cache-aside
  // ---------------------------------------------------------------------------

  /**
   * Cache-aside helper for arbitrary queries.
   *
   * Usage:
   * ```ts
   * const result = await queryCacheService.cacheQuery(
   *   `${CACHE_PREFIXES.COURSE}:${id}`,
   *   () => this.courseRepo.findOneById(id),
   *   { ttlSeconds: CACHE_TTL.COURSE_DETAILS },
   * );
   * ```
   */
  async cacheQuery<T>(
    key: string,
    factory: () => Promise<T>,
    options: QueryCacheOptions = {},
  ): Promise<T> {
    const { ttlSeconds = CACHE_TTL.COURSE_METADATA, bypassCache = false } = options;

    if (!bypassCache) {
      const cached = await this.caching.get<T>(key);
      if (cached !== undefined) {
        this.hits += 1;
        this.logger.debug(`Cache HIT  key=${key}`);
        return cached;
      }
    }

    this.misses += 1;
    this.logger.debug(`Cache MISS key=${key}`);

    const value = await factory();
    await this.caching.set(key, value, ttlSeconds);
    return value;
  }

  // ---------------------------------------------------------------------------
  // Domain-specific helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolves the tenant identifier used to namespace cache keys. Falls back to
   * a shared `global` namespace when no tenant context is present (single-tenant
   * dev/test or genuinely global data).
   */
  private resolveTenantId(): string {
    return this.caching.getCurrentTenantId() ?? 'global';
  }

  /** Fetches a single course from cache, or calls `factory` on a miss. */
  async getCourse<T>(
    courseId: string,
    factory: () => Promise<T>,
    options?: QueryCacheOptions,
  ): Promise<T> {
    const key = buildCourseKey(this.resolveTenantId(), courseId);
    return this.cacheQuery(key, factory, { ttlSeconds: CACHE_TTL.COURSE_DETAILS, ...options });
  }

  /** Fetches the published-courses list from cache. */
  async getCourseList<T>(factory: () => Promise<T>, options?: QueryCacheOptions): Promise<T> {
    const key = buildCourseListKey(this.resolveTenantId(), 'published');
    return this.cacheQuery(key, factory, { ttlSeconds: CACHE_TTL.COURSE_METADATA, ...options });
  }

  /** Fetches a user profile from cache. */
  async getUserProfile<T>(
    userId: string,
    factory: () => Promise<T>,
    options?: QueryCacheOptions,
  ): Promise<T> {
    const key = buildUserProfileKey(this.resolveTenantId(), userId);
    return this.cacheQuery(key, factory, { ttlSeconds: CACHE_TTL.USER_PROFILE, ...options });
  }

  /** Fetches search results from cache. */
  async getSearchResults<T>(
    query: string,
    filters: SearchFilters | undefined,
    factory: () => Promise<T>,
    options?: QueryCacheOptions,
  ): Promise<T> {
    const key = buildSearchCacheKey(this.resolveTenantId(), query, filters);
    return this.cacheQuery(key, factory, { ttlSeconds: CACHE_TTL.SEARCH_RESULTS, ...options });
  }

  // ---------------------------------------------------------------------------
  // Explicit invalidation helpers
  // ---------------------------------------------------------------------------

  /** Invalidates all cache entries for the given course. */
  async invalidateCourse(courseId: string): Promise<void> {
    this.invalidations += 1;
    await this.invalidation.invalidateCourseCache(courseId);
    this.logger.log(
      `Invalidated course cache: courseId=${courseId} (event=${CACHE_EVENTS.COURSE_UPDATED})`,
    );
  }

  /** Invalidates all cache entries for the given user. */
  async invalidateUser(userId: string): Promise<void> {
    this.invalidations += 1;
    await this.invalidation.invalidateUserCache(userId);
    this.logger.log(
      `Invalidated user cache: userId=${userId} (event=${CACHE_EVENTS.USER_UPDATED})`,
    );
  }

  /** Invalidates search result caches. */
  async invalidateSearch(): Promise<void> {
    this.invalidations += 1;
    await this.invalidation.invalidatePattern(`${CACHE_PREFIXES.SEARCH}:*`);
    this.logger.log(`Invalidated search cache (event=${CACHE_EVENTS.SEARCH_INDEX_UPDATED})`);
  }

  // ---------------------------------------------------------------------------
  // Monitoring
  // ---------------------------------------------------------------------------

  /**
   * Returns current hit/miss counters and the computed hit rate.
   * These are in-process counters; for production monitoring use the
   * `CacheAnalyticsService` which aggregates per-key metrics in Redis.
   */
  getStats(): QueryCacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : (this.hits / total) * 100,
      invalidations: this.invalidations,
    };
  }

  /** Resets the in-process hit/miss counters (useful in tests). */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.invalidations = 0;
  }
}
