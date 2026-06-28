import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { FingerprintModule } from './fingerprint/fingerprint.module';
import { FingerprintInterceptor } from './fingerprint/fingerprint.interceptor';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
import { SegmentModule } from './segment/segment.module';
import { AnalyticsEvent } from './entities/event.entity';
import { EventBatchingService } from './services/event-batching.service';
import { EventValidationService } from './services/event-validation.service';
import { EventTrackingSDK } from './sdk/event-tracking.sdk';
import { AnalyticsRetentionTask } from './tasks/analytics-retention.task';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalyticsEvent]),
    forwardRef(() => FingerprintModule),
    SegmentModule,
  ],
  providers: [
    MetricsCollectionService,
    AnalyticsService,
    EventBatchingService,
    EventValidationService,
    EventTrackingSDK,
    AnalyticsRetentionTask,
    { provide: APP_INTERCEPTOR, useClass: FingerprintInterceptor },
  ],
  controllers: [AnalyticsController],
  exports: [
    AnalyticsService,
    EventBatchingService,
    EventValidationService,
    EventTrackingSDK,
    FingerprintModule,
    SegmentModule,
  ],
})
export class AnalyticsModule {}
