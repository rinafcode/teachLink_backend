import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentSafetyService } from './safety/content-safety.service';
import { AutoModerationService } from './auto/auto-moderation.service';
import { ManualReviewService } from './manual/manual-review.service';
import { ReviewItem } from './manual/review-item.entity';
import { ModerationAnalyticsService } from './analytics/moderation-analytics.service';
import { ModerationEvent } from './analytics/moderation-event.entity';
import { ContentReport } from './reports/content-report.entity';
import { ContentReportingService } from './reports/content-reporting.service';
import { ContentReportsController } from './reports/content-reports.controller';

/**
 * Registers the moderation module, exposing content safety and review services.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ReviewItem, ModerationEvent, ContentReport])],
  controllers: [ContentReportsController],
  providers: [
    ContentSafetyService,
    AutoModerationService,
    ManualReviewService,
    ModerationAnalyticsService,
    ContentReportingService,
  ],
  exports: [
    ContentSafetyService,
    AutoModerationService,
    ManualReviewService,
    ModerationAnalyticsService,
    ContentReportingService,
  ],
})
export class ModerationModule {}
