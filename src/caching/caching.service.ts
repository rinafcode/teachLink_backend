import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CACHE_REDIS_CLIENT, CACHE_TTL } from './caching.constants';

export interface ICacheOptions {
  ttl?: number;
  prefix?: string;
}

/**
 * Provides caching operations.
 */
@Injectable()
export class CachingService implements OnModuleDestroy {
  private readonly logger = new Logger(CachingService.name);
  private readonly defaultTtl: number;

  constructor(
    @Inject(CACHE_REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.defaultTtl = parseInt(this.configService.get<string>('REDIS_TTL') || '300', 10);
  }

  /**
   * Executes on Module Destroy.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }

  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns The cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) {
        return null;
      }

      try {
        return JSON.parse(data) as T;
      } catch {
        // Return raw string if not valid JSON
        return data as unknown as T;
      }
    } catch (error) {
      this.logger.error(`Failed to get cache key: ${key}`, error);
      return null;
    }
  }

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      const effectiveTtl = ttl ?? this.defaultTtl;

      if (effectiveTtl > 0) {
        await this.redis.set(key, serializedValue, 'EX', effectiveTtl);
      } else {
        await this.redis.set(key, serializedValue);
      }
    } catch (error) {
      this.logger.error(`Failed to set cache key: ${key}`, error);
    }
  }

  /**
   * Delete a key from cache
   * @param key - Cache key to delete
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete cache key: ${key}`, error);
    }
  }

  /**
   * Delete all keys matching a pattern
   * @param pattern - Pattern to match (e.g., 'cache:course:*')
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.scanKeys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      await this.redis.del(...keys);
      this.logger.debug(`Deleted ${keys.length} keys matching pattern: ${pattern}`);
      return keys.length;
    } catch (error) {
      this.logger.error(`Failed to delete cache pattern: ${pattern}`, error);
      return 0;
    }
  }

  /**
   * Get a value from cache, or execute factory function and cache the result
   * @param key - Cache key
   * @param factory - Function to execute if value not in cache
   * @param ttl - Time to live in seconds (optional)
   * @returns The cached or freshly computed value
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Check if a key exists in cache
   * @param key - Cache key
   * @returns True if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check cache key existence: ${key}`, error);
      return false;
    }
  }

  /**
   * Get the TTL of a key
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async getTtl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error(`Failed to get TTL for key: ${key}`, error);
      return -2;
    }
  }

  /**
   * Set the TTL of an existing key
   * @param key - Cache key
   * @param ttl - New TTL in seconds
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.redis.expire(key, ttl);
    } catch (error) {
      this.logger.error(`Failed to set expiry for key: ${key}`, error);
    }
  }

  /**
   * Increment a counter
   * @param key - Cache key
   * @param increment - Amount to increment (default: 1)
   * @returns New value after increment
   */
  async incr(key: string, increment = 1): Promise<number> {
    try {
      if (increment === 1) {
        return await this.redis.incr(key);
      }
      return await this.redis.incrby(key, increment);
    } catch (error) {
      this.logger.error(`Failed to increment key: ${key}`, error);
      return 0;
    }
  }

  /**
   * Get multiple values at once
   * @param keys - Array of cache keys
   * @returns Array of values (null for missing keys)
   */
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    if (keys.length === 0) {
      return [];
    }

    try {
      const values = await this.redis.mget(...keys);
      return values.map((data) => {
        if (!data) return null;
        try {
          return JSON.parse(data) as T;
        } catch {
          return data as unknown as T;
        }
      });
    } catch (error) {
      this.logger.error('Failed to get multiple cache keys', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values at once
   * @param entries - Array of key-value pairs
   * @param ttl - Time to live in seconds (optional)
   */
  async mset<T>(entries: Array<{ key: string; value: T }>, ttl?: number): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    try {
      const pipeline = this.redis.pipeline();

      for (const { key, value } of entries) {
        const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

        if (ttl && ttl > 0) {
          pipeline.set(key, serializedValue, 'EX', ttl);
        } else {
          pipeline.set(key, serializedValue);
        }
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.error('Failed to set multiple cache keys', error);
    }
  }

  /**
   * Scan keys matching a pattern
   * @param pattern - Pattern to match
   * @param count - Approximate number of keys to return per iteration
   * @returns Array of matching keys
   */
  private async scanKeys(pattern: string, count = 100): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, matchedKeys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        count,
      );
      cursor = nextCursor;
      keys.push(...matchedKeys);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  async getStats(): Promise<{
    keys: number;
    memory: string;
    hits: number;
    misses: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const keyspaceInfo = await this.redis.info('keyspace');

      // Parse memory usage
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memory = memoryMatch ? memoryMatch[1] : 'unknown';

      // Parse key count
      const dbMatch = keyspaceInfo.match(/db\d+:keys=(\d+)/);
      const keys = dbMatch ? parseInt(dbMatch[1], 10) : 0;

      // Parse hit/miss stats
      const statsInfo = await this.redis.info('stats');
      const hitsMatch = statsInfo.match(/keyspace_hits:(\d+)/);
      const missesMatch = statsInfo.match(/keyspace_misses:(\d+)/);

      return {
        keys,
        memory,
        hits: hitsMatch ? parseInt(hitsMatch[1], 10) : 0,
        misses: missesMatch ? parseInt(missesMatch[1], 10) : 0,
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', error);
      return {
        keys: 0,
        memory: 'unknown',
        hits: 0,
        misses: 0,
      };
    }
  }

  /**
   * Clear all cache keys with the application prefix
   */
  async clearAll(): Promise<number> {
    return this.delPattern('cache:*');
  }

  /**
   * Generate a cache key with prefix
   * @param prefix - Key prefix
   * @param parts - Key parts to join
   * @returns Formatted cache key
   */
  generateKey(prefix: string, ...parts: Array<string | number>): string {
    return `${prefix}:${parts.join(':')}`;
  }

  /**
   * Get TTL constants for external use
   */
  getTTLConstants(): typeof CACHE_TTL {
    return CACHE_TTL;
  }
}
