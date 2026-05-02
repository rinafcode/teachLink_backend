import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CACHE_REDIS_CLIENT } from './caching.constants';
import { CachingService } from './caching.service';
import { CacheStrategiesService } from './strategies/cache-strategies.service';
import { CacheInvalidationService } from './invalidation/invalidation.service';
import { CacheWarmingService } from './warming/cache-warming.service';
import { CacheAnalyticsService } from './analytics/cache-analytics.service';
import { CacheManagementController } from './cache-management.controller';
import { getSharedRedisClient } from '../config/cache.config';

/**
 * Registers the caching module.
 */
@Global()
@Module({
  imports: [ConfigModule, EventEmitterModule],
  controllers: [CacheManagementController],
  providers: [
    // Redis client provider
    {
      provide: CACHE_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ReturnType<typeof getSharedRedisClient> =>
        getSharedRedisClient(configService),
    },
    // Cache services
    CachingService,
    CacheStrategiesService,
    CacheInvalidationService,
    CacheWarmingService,
    CacheAnalyticsService,
  ],
  exports: [
    CACHE_REDIS_CLIENT,
    CachingService,
    CacheStrategiesService,
    CacheInvalidationService,
    CacheWarmingService,
    CacheAnalyticsService,
  ],
})
export class CachingModule implements OnModuleDestroy {
  constructor(private readonly cachingService: CachingService) {}

  onModuleDestroy(): void {
    // Cleanup is handled by CachingService
  }
}
