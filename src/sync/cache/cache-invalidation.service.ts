import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Invalidates a specific cache key.
   */
  async invalidateKey(key: string): Promise<void> {
    this.logger.log(`Invalidating cache key: ${key}`);
    await this.cacheManager.del(key);
    this.eventEmitter.emit('cache.invalidated', { key, type: 'single' });
  }

  /**
   * Invalidates multiple cache keys based on a pattern.
   * Note: Standard cache-manager doesn't support pattern deletion easily with all stores,
   * so this is a simplified implementation.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    this.logger.log(`Invalidating cache pattern: ${pattern}`);
    
    // In a production environment with Redis, we'd use 'SCAN' and 'DEL'
    // For now, we'll emit an event that other specialized listeners might handle
    this.eventEmitter.emit('cache.invalidated', { pattern, type: 'pattern' });
    
    // If the store supports a store-specific method, call it here.
    const store: any = (this.cacheManager as any).store;
    if (store && typeof store.keys === 'function') {
      const keys = await store.keys(pattern);
      if (keys && keys.length > 0) {
        await Promise.all(keys.map((key: string) => this.cacheManager.del(key)));
      }
    }
  }

  /**
   * Automatically invalidates cache based on data change events.
   */
  async handleDataChange(entity: string, id: string): Promise<void> {
    this.logger.log(`Handling data change for ${entity}:${id}`);
    
    const specificKey = `${entity}:${id}`;
    const collectionKey = `${entity}:list:*`;

    await this.invalidateKey(specificKey);
    await this.invalidatePattern(collectionKey);
  }

  /**
   * Purges the entire cache.
   */
  async purgeAll(): Promise<void> {
    this.logger.warn('Purging entire cache');
    // cache-manager v5+ uses clear() instead of reset()
    if (typeof this.cacheManager.clear === 'function') {
      await this.cacheManager.clear();
    } else if (typeof (this.cacheManager as any).reset === 'function') {
      await (this.cacheManager as any).reset();
    }
    this.eventEmitter.emit('cache.purged', { timestamp: new Date() });
  }
}
