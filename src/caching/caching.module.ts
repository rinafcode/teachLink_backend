import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { CACHE_REDIS_CLIENT } from './caching.constants';
import { CachingService } from './caching.service';
import { CacheStrategiesService } from './strategies/cache-strategies.service';
import { CacheInvalidationService } from './invalidation/invalidation.service';
import { CacheWarmingService } from './warming/cache-warming.service';
import { CacheAnalyticsService } from './analytics/cache-analytics.service';
import { CacheManagementController } from './cache-management.controller';

@Global()
@Module({
  imports: [ConfigModule, EventEmitterModule],
  controllers: [CacheManagementController],
  providers: [
    // Redis client provider
    {
      provide: CACHE_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const client = new Redis({
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: parseInt(configService.get<string>('REDIS_PORT') || '6379', 10),
          lazyConnect: false,
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        });

        client.on('error', () => {
          // Prevent unhandled error events when Redis is temporarily unavailable.
        });

        return client;
      },
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

  onModuleDestroy() {
    // Cleanup is handled by CachingService
  }
}
