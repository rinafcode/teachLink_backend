import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { CacheStrategiesService } from './strategies/cache-strategies.service';
import type { CacheAnalyticsService } from './analytics/cache-analytics.service';

export interface CacheOptions {
  ttl?: number;
  strategy?: 'lru' | 'lfu' | 'fifo' | 'ttl';
  tags?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  compress?: boolean;
  serialize?: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  tags: string[];
  priority: string;
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRatio: number;
  totalKeys: number;
  memoryUsage: number;
  avgResponseTime: number;
}

@Injectable()
export class CachingService implements OnModuleInit {
  private readonly logger = new Logger(CachingService.name);
  private localCache = new Map<string, CacheEntry>();
  private readonly maxLocalCacheSize = 1000;
  private cacheStats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRatio: 0,
    totalKeys: 0,
    memoryUsage: 0,
    avgResponseTime: 0,
  };

  constructor(
    private cacheManager: Cache,
    private readonly strategies: CacheStrategiesService,
    private readonly analytics: CacheAnalyticsService,
  ) {}

  async onModuleInit() {
    this.logger.log('Advanced caching system initialized');
    await this.initializeCache();
  }

  private async initializeCache() {
    // Initialize cache statistics
    await this.updateCacheStats();
    this.logger.log('Cache statistics initialized');
  }

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Try local cache first (L1)
      const localEntry = this.localCache.get(key);
      if (localEntry && this.isValidEntry(localEntry)) {
        localEntry.lastAccessed = new Date();
        localEntry.accessCount++;
        this.cacheStats.hits++;
        this.analytics.recordCacheHit(key, 'local', Date.now() - startTime);
        return localEntry.value as T;
      }

      // Try distributed cache (L2)
      const distributedValue = await this.cacheManager.get<T>(key);
      if (distributedValue !== null && distributedValue !== undefined) {
        // Store in local cache for faster future access
        await this.setLocal(key, distributedValue, options);
        this.cacheStats.hits++;
        this.analytics.recordCacheHit(
          key,
          'distributed',
          Date.now() - startTime,
        );
        return distributedValue;
      }

      // Cache miss
      this.cacheStats.misses++;
      this.analytics.recordCacheMiss(key, Date.now() - startTime);
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}`, error);
      this.cacheStats.misses++;
      return null;
    } finally {
      this.updateHitRatio();
    }
  }

  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {},
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const ttl = options.ttl || 300;
      const strategy = options.strategy || 'lru';

      // Apply caching strategy
      const processedValue = await this.strategies.applyStrategy(
        key,
        value,
        strategy,
        options,
      );

      // Set in distributed cache
      await this.cacheManager.set(key, processedValue, ttl * 1000);

      // Set in local cache
      await this.setLocal(key, processedValue, options);

      // Update analytics
      this.analytics.recordCacheSet(
        key,
        this.calculateSize(processedValue),
        Date.now() - startTime,
      );

      this.logger.debug(
        `Cache set: ${key} (TTL: ${ttl}s, Strategy: ${strategy})`,
      );
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}`, error);
      throw error;
    }
  }

  private async setLocal<T>(
    key: string,
    value: T,
    options: CacheOptions = {},
  ): Promise<void> {
    // Implement LRU eviction if cache is full
    if (this.localCache.size >= this.maxLocalCacheSize) {
      await this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      ttl: options.ttl || 300,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      tags: options.tags || [],
      priority: options.priority || 'medium',
      size: this.calculateSize(value),
    };

    this.localCache.set(key, entry);
  }

  private async evictLeastRecentlyUsed(): Promise<void> {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.localCache.entries()) {
      if (entry.lastAccessed.getTime() < oldestTime) {
        oldestTime = entry.lastAccessed.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.localCache.delete(oldestKey);
      this.logger.debug(`Evicted LRU entry: ${oldestKey}`);
    }
  }

  private isValidEntry(entry: CacheEntry): boolean {
    const now = Date.now();
    const expiryTime = entry.createdAt.getTime() + entry.ttl * 1000;
    return now < expiryTime;
  }

  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      // Remove from both caches
      await this.cacheManager.del(key);
      this.localCache.delete(key);
      this.analytics.recordCacheDelete(key);
      this.logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}`, error);
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    try {
      // For Redis, we can use SCAN with pattern matching
      const keys = await this.getKeysByPattern(pattern);
      await Promise.all(keys.map((key) => this.delete(key)));
      this.logger.debug(
        `Cache pattern deleted: ${pattern} (${keys.length} keys)`,
      );
    } catch (error) {
      this.logger.error(
        `Cache pattern delete error for pattern ${pattern}`,
        error,
      );
    }
  }

  async deleteByTags(tags: string[]): Promise<void> {
    try {
      const keysToDelete: string[] = [];

      // Check local cache
      for (const [key, entry] of this.localCache.entries()) {
        if (tags.some((tag) => entry.tags.includes(tag))) {
          keysToDelete.push(key);
        }
      }

      // Delete found keys
      await Promise.all(keysToDelete.map((key) => this.delete(key)));
      this.logger.debug(
        `Cache tags deleted: ${tags.join(', ')} (${keysToDelete.length} keys)`,
      );
    } catch (error) {
      this.logger.error(
        `Cache tags delete error for tags ${tags.join(', ')}`,
        error,
      );
    }
  }

  private async getKeysByPattern(pattern: string): Promise<string[]> {
    // This is a simplified implementation
    // In a real Redis implementation, you'd use SCAN command
    const keys: string[] = [];
    const regex = new RegExp(pattern.replace('*', '.*'));

    for (const key of this.localCache.keys()) {
      if (regex.test(key)) {
        keys.push(key);
      }
    }

    return keys;
  }

  async clear(): Promise<void> {
    try {
      // If you use a custom cache store that supports reset, call it here.
      // For example, if using cache-manager-redis-store, you may need to access the underlying client directly.
      // Otherwise, implement manual clearing logic as needed.
      this.localCache.clear();
      this.logger.log('Cache cleared');
    } catch (error) {
      this.logger.error('Cache clear error', error);
    }
  }

  async getStats(): Promise<CacheStats> {
    await this.updateCacheStats();
    return { ...this.cacheStats };
  }

  private async updateCacheStats(): Promise<void> {
    try {
      this.cacheStats.totalKeys = this.localCache.size;
      this.cacheStats.memoryUsage = Array.from(this.localCache.values()).reduce(
        (total, entry) => total + entry.size,
        0,
      );
      this.updateHitRatio();
    } catch (error) {
      this.logger.error('Error updating cache stats', error);
    }
  }

  private updateHitRatio(): void {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    this.cacheStats.hitRatio =
      total > 0 ? (this.cacheStats.hits / total) * 100 : 0;
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get<T>(key);
        results.set(key, value);
      }),
    );

    return results;
  }

  async mset<T>(
    entries: Map<string, T>,
    options: CacheOptions = {},
  ): Promise<void> {
    await Promise.all(
      Array.from(entries.entries()).map(([key, value]) =>
        this.set(key, value, options),
      ),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (this.localCache.has(key)) {
        const entry = this.localCache.get(key)!;
        if (this.isValidEntry(entry)) {
          return true;
        }
      }

      const value = await this.cacheManager.get(key);
      return value !== null && value !== undefined;
    } catch (error) {
      this.logger.error(`Cache exists check error for key ${key}`, error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const entry = this.localCache.get(key);
      if (entry && this.isValidEntry(entry)) {
        const remaining =
          entry.createdAt.getTime() + entry.ttl * 1000 - Date.now();
        return Math.max(0, Math.floor(remaining / 1000));
      }
      return -1;
    } catch (error) {
      this.logger.error(`Cache TTL check error for key ${key}`, error);
      return -1;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      const value = await this.get(key);
      if (value !== null) {
        await this.set(key, value, { ttl });
      }
    } catch (error) {
      this.logger.error(`Cache expire error for key ${key}`, error);
    }
  }

  getLocalCacheEntries(): CacheEntry[] {
    return Array.from(this.localCache.values());
  }

  async warmup(
    keys: string[],
    factory: (key: string) => Promise<any>,
  ): Promise<void> {
    this.logger.log(`Warming up cache for ${keys.length} keys`);

    await Promise.all(
      keys.map(async (key) => {
        try {
          const exists = await this.exists(key);
          if (!exists) {
            const value = await factory(key);
            await this.set(key, value, { priority: 'high' });
          }
        } catch (error) {
          this.logger.error(`Cache warmup error for key ${key}`, error);
        }
      }),
    );
  }
}
