import { Module, forwardRef } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { FingerprintModule } from './fingerprint/fingerprint.module';
import { FingerprintInterceptor } from './fingerprint/fingerprint.interceptor';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';

@Module({
  imports: [forwardRef(() => FingerprintModule)],
  providers: [
    MetricsCollectionService,
    AnalyticsService,
    { provide: APP_INTERCEPTOR, useClass: FingerprintInterceptor },
  ],
  controllers: [AnalyticsController],
  exports: [AnalyticsService, FingerprintModule],
})
export class AnalyticsModule {}
