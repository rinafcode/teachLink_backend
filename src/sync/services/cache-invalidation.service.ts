import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface CacheInvalidationStrategy {
  immediate: boolean;
  lazy: boolean;
  scheduled: boolean;
  tags: string[];
  dependencies: string[];
}

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private readonly cacheProviders = new Map<string, any>();
  private readonly invalidationStrategies = new Map<
    string,
    CacheInvalidationStrategy
  >();
  private readonly pendingInvalidations = new Set<string>();

  constructor(private readonly syncQueue: Queue) {}

  async registerCacheProvider(name: string, provider: any): Promise<void> {
    this.cacheProviders.set(name, provider);
    this.logger.log(`Registered cache provider: ${name}`);
  }

  async registerInvalidationStrategy(
    entityType: string,
    strategy: CacheInvalidationStrategy,
  ): Promise<void> {
    this.invalidationStrategies.set(entityType, strategy);
    this.logger.log(`Registered invalidation strategy for ${entityType}`);
  }

  async invalidateEntity(
    entityType: string,
    entityId: string,
    strategy: 'immediate' | 'lazy' | 'scheduled' = 'immediate',
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(entityType, entityId);
    const entityStrategy = this.invalidationStrategies.get(entityType);

    switch (strategy) {
      case 'immediate':
        await this.immediateInvalidation(cacheKey, entityStrategy);
        break;
      case 'lazy':
        await this.lazyInvalidation(cacheKey, entityStrategy);
        break;
      case 'scheduled':
        await this.scheduleInvalidation(cacheKey, entityStrategy);
        break;
    }

    // Invalidate dependent entities
    if (entityStrategy?.dependencies) {
      for (const dependency of entityStrategy.dependencies) {
        await this.invalidateDependentEntity(dependency, entityId);
      }
    }

    this.logger.log(
      `Cache invalidated for ${entityType}:${entityId} using ${strategy} strategy`,
    );
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    const invalidationPromises = [];

    for (const provider of this.cacheProviders.values()) {
      if (provider.invalidateByTags) {
        invalidationPromises.push(provider.invalidateByTags(tags));
      }
    }

    await Promise.allSettled(invalidationPromises);
    this.logger.log(`Cache invalidated for tags: ${tags.join(', ')}`);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const invalidationPromises = [];

    for (const provider of this.cacheProviders.values()) {
      if (provider.invalidateByPattern) {
        invalidationPromises.push(provider.invalidateByPattern(pattern));
      }
    }

    await Promise.allSettled(invalidationPromises);
    this.logger.log(`Cache invalidated for pattern: ${pattern}`);
  }

  async bulkInvalidate(
    entities: Array<{ entityType: string; entityId: string }>,
    strategy: 'immediate' | 'lazy' | 'scheduled' = 'immediate',
  ): Promise<void> {
    const batchSize = 100;
    const batches = [];

    for (let i = 0; i < entities.length; i += batchSize) {
      batches.push(entities.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const promises = batch.map((entity) =>
        this.invalidateEntity(entity.entityType, entity.entityId, strategy),
      );

      await Promise.allSettled(promises);
    }

    this.logger.log(
      `Bulk cache invalidation completed for ${entities.length} entities`,
    );
  }

  async warmCache(
    entityType: string,
    entityId: string,
    data: any,
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(entityType, entityId);
    const strategy = this.invalidationStrategies.get(entityType);

    const warmingPromises = [];
    for (const [providerName, provider] of this.cacheProviders) {
      if (provider.set) {
        const ttl = this.calculateTTL(entityType, strategy);
        warmingPromises.push(
          provider.set(cacheKey, data, ttl).catch((error) => {
            this.logger.warn(
              `Failed to warm cache in ${providerName}: ${error.message}`,
            );
          }),
        );
      }
    }

    await Promise.allSettled(warmingPromises);
    this.logger.log(`Cache warmed for ${entityType}:${entityId}`);
  }

  async getCacheStats(): Promise<{
    providers: Array<{
      name: string;
      hitRate: number;
      size: number;
      memory: number;
    }>;
    invalidations: {
      immediate: number;
      lazy: number;
      scheduled: number;
      failed: number;
    };
  }> {
    const providers = [];
    for (const [name, provider] of this.cacheProviders) {
      if (provider.getStats) {
        try {
          const stats = await provider.getStats();
          providers.push({
            name,
            hitRate: stats.hitRate || 0,
            size: stats.size || 0,
            memory: stats.memory || 0,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to get stats from ${name}: ${error.message}`,
          );
        }
      }
    }

    // Mock invalidation stats - would be tracked in real implementation
    const invalidations = {
      immediate: 0,
      lazy: 0,
      scheduled: 0,
      failed: 0,
    };

    return { providers, invalidations };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledInvalidations(): Promise<void> {
    if (this.pendingInvalidations.size === 0) return;

    const invalidationsToProcess = Array.from(this.pendingInvalidations);
    this.pendingInvalidations.clear();

    const promises = invalidationsToProcess.map(async (cacheKey) => {
      try {
        await this.performInvalidation(cacheKey);
      } catch (error) {
        this.logger.error(
          `Failed to process scheduled invalidation for ${cacheKey}: ${error.message}`,
        );
      }
    });

    await Promise.allSettled(promises);

    if (invalidationsToProcess.length > 0) {
      this.logger.log(
        `Processed ${invalidationsToProcess.length} scheduled cache invalidations`,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredCache(): Promise<void> {
    const cleanupPromises = [];

    for (const [providerName, provider] of this.cacheProviders) {
      if (provider.cleanup) {
        cleanupPromises.push(
          provider.cleanup().catch((error) => {
            this.logger.warn(
              `Cache cleanup failed for ${providerName}: ${error.message}`,
            );
          }),
        );
      }
    }

    await Promise.allSettled(cleanupPromises);
    this.logger.log('Cache cleanup completed');
  }

  private async immediateInvalidation(
    cacheKey: string,
    strategy?: CacheInvalidationStrategy,
  ): Promise<void> {
    await this.performInvalidation(cacheKey);

    // Invalidate by tags if specified
    if (strategy?.tags) {
      await this.invalidateByTags(strategy.tags);
    }
  }

  private async lazyInvalidation(
    cacheKey: string,
    strategy?: CacheInvalidationStrategy,
  ): Promise<void> {
    // Mark cache entry as stale instead of removing it
    const stalePromises = [];

    for (const provider of this.cacheProviders.values()) {
      if (provider.markStale) {
        stalePromises.push(provider.markStale(cacheKey));
      } else if (provider.expire) {
        // Set very short TTL as fallback
        stalePromises.push(provider.expire(cacheKey, 1));
      }
    }

    await Promise.allSettled(stalePromises);
  }

  private async scheduleInvalidation(
    cacheKey: string,
    strategy?: CacheInvalidationStrategy,
  ): Promise<void> {
    this.pendingInvalidations.add(cacheKey);

    // Also schedule via queue for reliability
    await this.syncQueue.add(
      'cache-invalidation',
      { cacheKey, strategy },
      {
        delay: 5000, // 5 second delay
        attempts: 3,
      },
    );
  }

  private async performInvalidation(cacheKey: string): Promise<void> {
    const invalidationPromises = [];

    for (const [providerName, provider] of this.cacheProviders) {
      if (provider.del) {
        invalidationPromises.push(
          provider.del(cacheKey).catch((error) => {
            this.logger.warn(
              `Cache invalidation failed for ${providerName}: ${error.message}`,
            );
          }),
        );
      }
    }

    await Promise.allSettled(invalidationPromises);
  }

  private async invalidateDependentEntity(
    dependencyType: string,
    entityId: string,
  ): Promise<void> {
    // Get all entities that depend on this entity
    const dependentEntities = await this.getDependentEntities(
      dependencyType,
      entityId,
    );

    for (const dependent of dependentEntities) {
      await this.invalidateEntity(
        dependent.entityType,
        dependent.entityId,
        'immediate',
      );
    }
  }

  private generateCacheKey(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
  }

  private calculateTTL(
    entityType: string,
    strategy?: CacheInvalidationStrategy,
  ): number {
    // Default TTL based on entity type
    const defaultTTLs = {
      User: 3600, // 1 hour
      Product: 1800, // 30 minutes
      Order: 300, // 5 minutes
    };

    return defaultTTLs[entityType] || 1800;
  }

  private async getDependentEntities(
    dependencyType: string,
    entityId: string,
  ): Promise<Array<{ entityType: string; entityId: string }>> {
    // Mock implementation - would query actual dependencies
    return [];
  }
}
