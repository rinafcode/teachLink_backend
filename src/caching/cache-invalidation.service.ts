import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { APP_EVENTS } from '../common/constants/event.constants';
import { getSharedRedisClient } from '../config/cache.config';
import { CACHE_PREFIXES } from './caching.constants';

interface CacheStoreWithKeys {
  keys?(pattern: string): Promise<string[]> | string[];
}

interface CacheManagerExtended extends Cache {
  store?: CacheStoreWithKeys;
  reset?(): Promise<void>;
}

/**
 * Provides cache invalidation operations for the cache-aside layer.
 */
@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private eventEmitter: EventEmitter2,
  ) {}

  async invalidateKey(key: string): Promise<void> {
    this.logger.log(`Invalidating cache key: ${key}`);
    await this.cacheManager.del(key);
    this.eventEmitter.emit(APP_EVENTS.CACHE_INVALIDATED, { key, type: 'single' });
  }

  async invalidatePattern(pattern: string): Promise<void> {
    this.logger.log(`Invalidating cache pattern: ${pattern}`);
    this.eventEmitter.emit(APP_EVENTS.CACHE_INVALIDATED, { pattern, type: 'pattern' });

    const store = (this.cacheManager as CacheManagerExtended).store;
    if (store?.keys) {
      const keys = await store.keys(pattern);
      const list = Array.isArray(keys) ? keys : [];
      if (list.length > 0) {
        await Promise.all(list.map((key: string) => this.cacheManager.del(key)));
      }
      return;
    }

    await this.invalidatePatternViaRedisScan(pattern);
  }

  async invalidateCourseCache(courseId: string): Promise<void> {
    await this.invalidateKey(`${CACHE_PREFIXES.COURSE}:${courseId}`);
    await this.invalidatePattern(`${CACHE_PREFIXES.COURSES_LIST}:*`);
    await this.invalidatePattern(`${CACHE_PREFIXES.POPULAR}:*`);
    await this.invalidatePattern(`${CACHE_PREFIXES.SEARCH}:*`);
  }

  async invalidateUserCache(userId: string): Promise<void> {
    await this.invalidateKey(`${CACHE_PREFIXES.USER}:${userId}`);
    await this.invalidateKey(`${CACHE_PREFIXES.USER_PROFILE}:${userId}`);
  }

  async handleDataChange(entity: string, id: string): Promise<void> {
    this.logger.log(`Handling data change for ${entity}:${id}`);

    if (entity === 'course' || entity.startsWith('cache:course')) {
      await this.invalidateCourseCache(id);
      return;
    }

    if (entity === 'user' || entity.startsWith('cache:user')) {
      await this.invalidateUserCache(id);
      return;
    }

    await this.invalidateKey(`${entity}:${id}`);
    await this.invalidatePattern(`${entity}:list:*`);
  }

  async purgeAll(): Promise<void> {
    this.logger.warn('Purging entire cache');
    if (typeof this.cacheManager.clear === 'function') {
      await this.cacheManager.clear();
    } else if (typeof (this.cacheManager as CacheManagerExtended).reset === 'function') {
      await (this.cacheManager as CacheManagerExtended).reset!();
    }
    this.eventEmitter.emit(APP_EVENTS.CACHE_PURGED, { timestamp: new Date() });
  }

  private async invalidatePatternViaRedisScan(pattern: string): Promise<void> {
    const redis = getSharedRedisClient();
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}
