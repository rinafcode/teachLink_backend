import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import Redis from 'ioredis';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
import { getSharedRedisClient } from '../config/cache.config';

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * Per-key type derivation:
 *
 *  - `cache:test:1`          → type `test`
 *  - `cache:user:42`         → type `user`
 *  - `cache:course:popular`  → type `course`
 *  - `hit-key`               → type `default`
 *
 * This provides a stable, coarse-grained namespace that aggregates traffic
 * across pods without blowing up the cardinality of the counter key space.
 */
const CACHE_TYPE_FALLBACK = 'default';

/**
 * Extracts the cache-type segment from a cache key.
 *
 * Cache keys follow a `cache:{type}:...` convention throughout the codebase.
 * For keys that don't match this pattern we fall back to a single `default`
 * bucket so that all such counters roll up under one key.
 */
export const deriveCacheType = (key: string): string => {
  if (typeof key !== 'string' || key.length === 0) {
    return CACHE_TYPE_FALLBACK;
  }

  const parts = key.split(':');
  if (parts.length >= 2 && parts[0] === 'cache') {
    return parts[1] || CACHE_TYPE_FALLBACK;
  }
  return CACHE_TYPE_FALLBACK;
};

/**
 * Builds the Redis counter keys for a given cache type.
 *
 * Keys are namespaced by cache type (per the issue spec) and live in the
 * `cache:hits:*` / `cache:misses:*` namespaces so they cannot collide with
 * cached application data.
 *
 * Daily reset is enforced by {@link CachingService.dailyReset} which runs
 * nightly via a NestJS cron job.
 */
export const buildCounterKeys = (cacheType: string): { hits: string; misses: string } => ({
  hits: `cache:hits:${cacheType}`,
  misses: `cache:misses:${cacheType}`,
});

@Injectable()
export class CachingService {
  private readonly logger = new Logger(CachingService.name);
  private readonly redis: Redis | undefined;
  private readonly fallbackLocal: boolean;

  // Local fallback counters — only used when Redis is unavailable or when
  // CACHE_COUNTER_FALLBACK_LOCAL=true is explicitly set. These intentionally
  // mirror the old instance variable behaviour so single-instance tests /
  // dev environments still report something useful instead of silently
  // returning zero hits.
  private localHits = 0;
  private localMisses = 0;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Optional() private readonly metrics?: MetricsCollectionService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() redis?: Redis,
  ) {
    // Prefer an explicitly injected client (used by tests / module overrides),
    // then fall back to the configured shared singleton, then to local-only.
    this.redis = redis ?? this.resolveRedisFromConfig();
    this.fallbackLocal = this.configService?.get<boolean>(
      'CACHE_COUNTER_FALLBACK_LOCAL',
      true,
    ) ?? true;
  }

  private resolveRedisFromConfig(): Redis | undefined {
    if (process.env.NODE_ENV === 'test') {
      // Never open a real Redis connection during tests that go through DI.
      // Tests that need to exercise Redis-backed behaviour inject a mock
      // client directly via the constructor.
      return undefined;
    }

    const enabled = this.configService?.get<boolean>('CACHE_COUNTER_ENABLE_REDIS', true);
    if (enabled === false) {
      return undefined;
    }
    try {
      return getSharedRedisClient(this.configService);
    } catch (err) {
      this.logger.warn(
        `Could not acquire shared Redis client for hit/miss counters — ` +
          `falling back to local in-process counters. ${(err as Error)?.message ?? ''}`,
      );
      return undefined;
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.cacheManager.get<T>(key);
    if (value === undefined || value === null) {
      await this.recordMiss(deriveCacheType(key), key);
      return undefined;
    }
    await this.recordHit(deriveCacheType(key), key);
    return value;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttlMs = ttlSeconds !== undefined ? ttlSeconds * 1000 : undefined;
    await this.cacheManager.set(key, value, ttlMs);
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async delete(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.cacheManager.del(key)));
  }

  async clear(): Promise<void> {
    if (typeof this.cacheManager.clear === 'function') {
      await this.cacheManager.clear();
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    try {
      const store = (this.cacheManager as any).store;

      if (store && store.client && typeof store.client.scan === 'function') {
        let cursor = '0';
        do {
          const result = await store.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = result[0];
          const keys = result[1];
          if (keys && keys.length > 0) {
            await store.client.del(...keys);
          }
        } while (cursor !== '0');
        return;
      }

      if (store && typeof store.keys === 'function') {
        const keys = await store.keys(pattern);
        if (keys && keys.length > 0) {
          await this.deleteMany(keys);
        }
        return;
      }

      this.logger.warn(
        `Pattern deletion not supported by current cache store for pattern: ${pattern}`,
      );
    } catch (error: any) {
      this.logger.error(`Failed to delete by pattern ${pattern}: ${error.message}`, error.stack);
    }
  }

  // ── Cluster-wide stats ─────────────────────────────────────────────────────

  /**
   * Returns the cluster-wide hit/miss stats for a given cache type.
   *
   * Reads from the shared Redis keys `cache:hits:{type}` and
   * `cache:misses:{type}` so the returned numbers reflect the aggregate
   * traffic across all pods rather than just the local instance.
   *
   * @param cacheType Cache type to query (defaults to `default`).
   */
  async getStats(cacheType: string = CACHE_TYPE_FALLBACK): Promise<CacheStats> {
    const resolvedType = cacheType || CACHE_TYPE_FALLBACK;
    const { hits: hitsKey, misses: missesKey } = buildCounterKeys(resolvedType);

    let hits = 0;
    let misses = 0;

    if (this.redis) {
      try {
        const results = await this.redis.mget(hitsKey, missesKey);
        hits = this.parseCounter(results[0]);
        misses = this.parseCounter(results[1]);
      } catch (err) {
        if (!this.fallbackLocal) {
          this.logger.error(
            `Failed to read distributed cache counters for type "${resolvedType}": ${(err as Error).message}`,
          );
          throw err;
        }
        this.logger.warn(
          `Failed to read distributed cache counters for type "${resolvedType}", ` +
            `falling back to local counters. ${(err as Error).message}`,
        );
        hits = this.localHits;
        misses = this.localMisses;
      }
    } else if (this.fallbackLocal) {
      hits = this.localHits;
      misses = this.localMisses;
    }

    const total = hits + misses;
    return {
      hits,
      misses,
      hitRate: total === 0 ? 0 : (hits / total) * 100,
    };
  }

  /**
   * Returns aggregate stats across every known cache type. Useful for top-level
   * dashboards that want a single cluster-wide hit-rate number rather than a
   * per-type breakdown.
   *
   * Each MATCH pattern is scanned in its own complete SCAN loop because Redis
   * SCAN cursors are per-iteration — sharing one cursor between two parallel
   * MATCH scans would terminate early whenever one of them reaches `'0'` and
   * silently drop keys from the other.
   */
  async getAggregateStats(): Promise<CacheStats> {
    if (!this.redis) {
      if (!this.fallbackLocal) {
        return { hits: 0, misses: 0, hitRate: 0 };
      }
      const total = this.localHits + this.localMisses;
      return {
        hits: this.localHits,
        misses: this.localMisses,
        hitRate: total === 0 ? 0 : (this.localHits / total) * 100,
      };
    }

    const hitsKeys = await this.scanKeys('cache:hits:*');
    const missesKeys = await this.scanKeys('cache:misses:*');

    if (hitsKeys.length === 0 && missesKeys.length === 0) {
      return { hits: 0, misses: 0, hitRate: 0 };
    }

    const hits = hitsKeys.length === 0 ? 0 : this.sumCounters(await this.redis.mget(...hitsKeys));
    const misses =
      missesKeys.length === 0 ? 0 : this.sumCounters(await this.redis.mget(...missesKeys));
    const total = hits + misses;
    return {
      hits,
      misses,
      hitRate: total === 0 ? 0 : (hits / total) * 100,
    };
  }

  /**
   * Publishes the cluster-wide cache hit rate to Prometheus.
   *
   * Now reads from Redis so the reported value reflects traffic from every
   * pod, not just this instance.
   */
  async publishHitRateMetrics(cacheType: string = 'application'): Promise<void> {
    const stats = await this.getStats(cacheType);
    this.metrics?.updateCacheHitRate(cacheType, stats.hitRate);
    this.logger.debug(
      `Cache hit rate (${cacheType}): ${stats.hitRate.toFixed(1)}% ` +
        `(hits=${stats.hits}, misses=${stats.misses})`,
    );
  }

  /**
   * Resets the distributed counters for a given cache type (or every known
   * type when called without an argument).
   *
   * Note: this only resets the distributed counters, NOT the underlying
   * cached application data.
   */
  async resetStats(cacheType?: string): Promise<void> {
    if (cacheType) {
      const { hits, misses } = buildCounterKeys(cacheType);
      await this.resetKeys([hits, misses]);
    } else if (this.redis) {
      const [hitsKeys, missesKeys] = await Promise.all([
        this.scanKeys('cache:hits:*'),
        this.scanKeys('cache:misses:*'),
      ]);
      await this.resetKeys([...hitsKeys, ...missesKeys]);
    }

    // Always reset the local in-process fallback so test runs are clean.
    this.localHits = 0;
    this.localMisses = 0;
  }

  /** Independently completes a SCAN over a single MATCH pattern. */
  private async scanKeys(pattern: string): Promise<string[]> {
    if (!this.redis) {
      return [];
    }
    const out: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      out.push(...(batch as string[]));
    } while (cursor !== '0');
    return out;
  }

  /** Sums the integer values stored in the supplied raw Redis values, defaulting to 0. */
  private sumCounters(rawValues: Array<string | null>): number {
    return rawValues.reduce((acc, v) => acc + this.parseCounter(v), 0);
  }

  /**
   * Daily cron: zeros all distributed hit/miss counters. Runs at midnight UTC
   * so dashboards see a clean daily slate without manual intervention.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'UTC' })
  async dailyReset(): Promise<void> {
    this.logger.log('Performing daily reset of distributed cache hit/miss counters');
    await this.resetStats();
  }

  // ── Internal: counter increments ──────────────────────────────────────────

  private parseCounter(value: string | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async recordHit(cacheType: string, key: string): Promise<void> {
    const { hits } = buildCounterKeys(cacheType);
    await this.incrOrFallback(hits, () => {
      this.localHits += 1;
    });
    this.logger.debug(`Cache hit: ${key}`);
  }

  private async recordMiss(cacheType: string, key: string): Promise<void> {
    const { misses } = buildCounterKeys(cacheType);
    await this.incrOrFallback(misses, () => {
      this.localMisses += 1;
    });
    this.logger.debug(`Cache miss: ${key}`);
  }

  /**
   * Atomically increments `redisKey` against Redis. If Redis is unavailable
   * (not configured, disabled, or errored) and local fallback is enabled,
   * `onFallback` is invoked so the in-process counter still moves forward.
   * If both Redis-writing and fallback are disabled the increment is silently
   * dropped — this matches the previous behaviour of relying on Redis to be
   * the source of truth.
   */
  private async incrOrFallback(redisKey: string, onFallback: () => void): Promise<void> {
    if (!this.redis) {
      if (this.fallbackLocal) {
        onFallback();
      }
      return;
    }
    try {
      await this.redis.incr(redisKey);
    } catch (err) {
      if (!this.fallbackLocal) {
        this.logger.error(
          `Failed to INCR ${redisKey} and local fallback is disabled: ${(err as Error).message}`,
          (err as Error).stack,
        );
        return;
      }
      onFallback();
      this.logger.debug(
        `Failed to INCR ${redisKey} — using local fallback counter. ${(err as Error).message}`,
      );
    }
  }

  private async resetKeys(keys: string[]): Promise<void> {
    if (!this.redis || keys.length === 0) {
      return;
    }
    try {
      await this.redis.del(...keys);
    } catch (err) {
      this.logger.error(
        `Failed to reset distributed cache counter keys: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
