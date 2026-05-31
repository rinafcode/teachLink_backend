import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { redisStore } from 'cache-manager-ioredis-yet';
import { Course } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { User } from '../users/entities/user.entity';
import { ProfileCompletenessService } from '../profile-completeness/profile-completeness.service';
import { SearchModule } from '../search/search.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { getRedisOptions } from '../config/cache.config';
import { CachingService } from './caching.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { CacheInvalidationListener } from './cache-invalidation.listener';
import { CacheWarmingService } from './cache-warming.service';
import { CacheWarmingScheduler } from './cache-warming.scheduler';

/**
 * Registers the application-level Redis cache layer, warming engine, and invalidation listeners.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    MonitoringModule,
    SearchModule,
    TypeOrmModule.forFeature([Course, Enrollment, User]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: async (configService: ConfigService) => {
        const ttlSeconds = parseInt(configService.get<string>('REDIS_TTL') || '60', 10);
        const ttlMs = ttlSeconds * 1000;
        const redisOptions = getRedisOptions(configService);

        if (process.env.NODE_ENV === 'test') {
          return { ttl: ttlMs };
        }

        return {
          store: await redisStore({
            host: redisOptions.host as string,
            port: redisOptions.port as number,
            ttl: ttlMs,
          }),
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
  ],
  exports: [CachingService, CacheInvalidationService, CacheWarmingService],
})
export class CachingModule {}
