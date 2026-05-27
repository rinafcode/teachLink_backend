import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { cacheConfig } from '../config/cache.config';
import { CacheAnalyticsService } from './cache-analytics.service';
import { CacheOptimizationService } from './cache-optimization.service';
import { CacheManagementController } from './cache-management.controller';
import { AdaptiveTTLService } from './adaptive-ttl.service';

@Module({
  imports: [
    CacheModule.register(cacheConfig),
    EventEmitterModule,
    ScheduleModule,
    ConfigModule,
  ],
  providers: [
    CacheAnalyticsService,
    CacheOptimizationService,
    AdaptiveTTLService,
  ],
  controllers: [CacheManagementController],
  exports: [
    CacheAnalyticsService,
    CacheOptimizationService,
    AdaptiveTTLService,
  ],
})
export class CachingModule {}