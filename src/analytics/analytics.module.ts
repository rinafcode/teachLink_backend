/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { EventTrackingService } from './events/event-tracking.service';
import { ReportGenerationService } from './report/report-generation.service';
import { LearningMetricsService } from './metrics/learning-metrics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    EventTrackingService,
    ReportGenerationService,
    LearningMetricsService,
  ],
  exports: [
    AnalyticsService,
    EventTrackingService,
    ReportGenerationService,
    LearningMetricsService,
  ],
})
export class AnalyticsModule {}
