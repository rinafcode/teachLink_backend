import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { redisInsStore } from 'cache-manager-ioredis-yet';
import type Redis from 'ioredis';
import { Course } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { ProfileCompletenessService } from '../profile-completeness/profile-completeness.service';
import { SearchModule } from '../search/search.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { RedisModule } from '../common/redis/redis.module';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import { CachingService } from './caching.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { CacheInvalidationListener } from './cache-invalidation.listener';
import { CacheWarmingService } from './cache-warming.service';
import { CacheWarmingScheduler } from './cache-warming.scheduler';
import { ComputationCacheService } from './computation-cache.service';

/**
 * Registers the application-level Redis cache layer, warming engine, and invalidation listeners.
 *
 * Issue #837 — the cache-manager store now wraps the shared `REDIS_CLIENT`
 * connection (standalone/Sentinel/Cluster, see `RedisModule`) via
 * `redisInsStore` instead of opening its own host/port connection, so
 * caching gains HA failover/sharding for free.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    MonitoringModule,
    SearchModule,
    TypeOrmModule.forFeature([Course, Enrollment, User]),
    RedisModule.forRoot(),
    CacheModule.registerAsync({
      imports: [ConfigModule, RedisModule.forRoot()],
      inject: [ConfigService, REDIS_CLIENT],
      isGlobal: true,
      useFactory: async (configService: ConfigService, redis: Redis) => {
        const ttlSeconds = parseInt(configService.get<string>('REDIS_TTL') || '60', 10);
        const ttlMs = ttlSeconds * 1000;

        if (process.env.NODE_ENV === 'test') {
          return { ttl: ttlMs };
        }

        return {
          store: redisInsStore(redis, { ttl: ttlMs }),
          ttl: ttlMs,
        };
      },
    }),
  ],
  providers: [
    CachingService,
    CacheInvalidationService,
    CacheInvalidationListener,
    CacheWarmingService,
    CacheWarmingScheduler,
    ProfileCompletenessService,
    ComputationCacheService,
  ],
  exports: [CachingService, CacheInvalidationService, CacheWarmingService, ComputationCacheService],
})
export class CachingModule {}
