import { Injectable, Logger, Optional } from '@nestjs/common';
import { CachingService } from './caching.service';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
import { COMPUTATION_TTL } from './caching.constants';
import { buildComputationKey } from './cache-key.builder';

export interface ComputationCacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * Provides aggressive caching for expensive computations.
 *
 * ## Problem
 * Certain operations — leaderboard ranking, user rank lookups — are O(n)
 * over the full dataset and run on every request. Without caching, these
 * hammer the database under load.
 *
 * ## Solution
 * Cache-aside pattern with:
 *   - Per-computation-type TTLs (see CACHE_TTL.COMPUTATION)
 *   - Stampede protection via in-flight promise deduplication
 *   - Hit/miss tracking published to Prometheus via MetricsCollectionService
 *
 * ## Usage
 * ```ts
 * const top = await this.computationCache.compute(
 *   'leaderboard:top-players',
 *   '10',
 *   () => this.leaderboardService.getTopPlayers(10),
 *   CACHE_TTL.COMPUTATION.LEADERBOARD,
 * );
 * ```
 */
@Injectable()
export class ComputationCacheService {
  private readonly logger = new Logger(ComputationCacheService.name);

  // In-flight promise map for stampede protection.
  // If multiple requests ask for the same key simultaneously while the cache
  // is cold, only one factory call is made — the rest await the same promise.
  private readonly inFlight = new Map<string, Promise<unknown>>();

  private hits = 0;
  private misses = 0;

  constructor(
    private readonly caching: CachingService,
    @Optional() private readonly metrics?: MetricsCollectionService,
  ) {}

  /**
   * Returns a cached result for the given computation key, or executes the
   * factory and caches the result for ttlSeconds.
   *
   * @param type       Short label for the computation type (e.g. 'leaderboard:top-players')
   * @param identifier Unique scope identifier (e.g. userId, limit value, 'global')
   * @param factory    Async function that performs the expensive computation
   * @param ttlSeconds How long to cache the result
   */
  async compute<T>(
    type: string,
    identifier: string,
    factory: () => Promise<T>,
    ttlSeconds: number,
  ): Promise<T> {
    const key = buildComputationKey(type, identifier);

    // ── Cache hit ──────────────────────────────────────────────────────────
    const cached = await this.caching.get<T>(key);
    if (cached !== undefined) {
      this.recordHit(type);
      return cached;
    }

    // ── Stampede protection ────────────────────────────────────────────────
    // If another request already kicked off the factory for this key, await
    // it instead of running a second concurrent DB query.
    if (this.inFlight.has(key)) {
      this.logger.debug(`Awaiting in-flight computation for key: ${key}`);
      return this.inFlight.get(key) as Promise<T>;
    }

    // ── Cache miss — run factory ───────────────────────────────────────────
    this.recordMiss(type);

    const promise = factory()
      .then(async (result) => {
        await this.caching.set(key, result, ttlSeconds);
        this.logger.debug(`Cached computation [${type}] key: ${key} TTL: ${ttlSeconds}s`);
        return result;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise as Promise<T>;
  }

  /**
   * Invalidates a specific computation cache entry.
   */
  async invalidate(type: string, identifier: string): Promise<void> {
    const key = buildComputationKey(type, identifier);
    await this.caching.delete(key);
    this.logger.debug(`Invalidated computation cache [${type}] key: ${key}`);
  }

  /**
   * Returns current hit/miss stats for this service instance.
   */
  getStats(): ComputationCacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : (this.hits / total) * 100,
    };
  }

  /**
   * Publishes computation cache hit rate to Prometheus.
   * Called by CacheWarmingScheduler on its existing 5-minute cron.
   */
  publishMetrics(): void {
    const { hitRate } = this.getStats();
    this.metrics?.updateCacheHitRate('computation', hitRate);
    this.logger.debug(`Computation cache hit rate: ${hitRate.toFixed(1)}%`);
  }

  private recordHit(type: string): void {
    this.hits += 1;
    this.logger.debug(`Computation cache hit [${type}]`);
  }

  private recordMiss(type: string): void {
    this.misses += 1;
    this.logger.debug(`Computation cache miss [${type}]`);
  }
}
