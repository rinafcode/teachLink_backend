import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

@Injectable()
export class CachingService {
  private readonly logger = new Logger(CachingService.name);
  private hits = 0;
  private misses = 0;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Optional() private readonly metrics?: MetricsCollectionService,
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.cacheManager.get<T>(key);
    if (value === undefined || value === null) {
      this.recordMiss(key);
      return undefined;
    }
    this.recordHit(key);
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

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : (this.hits / total) * 100,
    };
  }

  publishHitRateMetrics(cacheType = 'application'): void {
    const { hitRate } = this.getStats();
    this.metrics?.updateCacheHitRate(cacheType, hitRate);
    this.logger.debug(`Cache hit rate (${cacheType}): ${hitRate.toFixed(1)}%`);
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  private recordHit(key: string): void {
    this.hits += 1;
    this.logger.debug(`Cache hit: ${key}`);
  }

  private recordMiss(key: string): void {
    this.misses += 1;
    this.logger.debug(`Cache miss: ${key}`);
  }
}
