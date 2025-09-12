import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { redisStore } from 'cache-manager-redis-store';
import { CachingService } from './caching.service';
import { CacheWarmingService } from './warming/cache-warming.service';
import { InvalidationService } from './invalidation/invalidation.service';
import { CacheAnalyticsService } from './analytics/cache-analytics.service';
import { CacheStrategiesService } from './strategies/cache-strategies.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: () => ({
        store: redisStore,
        host: process.env.REDIS_HOST || 'localhost',
        port: Number.parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: Number.parseInt(process.env.REDIS_DB || '0'),
        ttl: 300, // Default TTL: 5 minutes
        max: 1000, // Maximum number of items in cache
        isGlobal: true,
      }),
    }),
    ScheduleModule.forRoot(),
  ],
  providers: [
    CachingService,
    CacheWarmingService,
    InvalidationService,
    CacheAnalyticsService,
    CacheStrategiesService,
  ],
  exports: [
    CachingService,
    CacheWarmingService,
    InvalidationService,
    CacheAnalyticsService,
    CacheStrategiesService,
  ],
})
export class CachingModule {}
