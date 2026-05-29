import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentSafetyService } from './safety/content-safety.service';
import { AutoModerationService } from './auto/auto-moderation.service';
import { ManualReviewService } from './manual/manual-review.service';
import { ReviewItem } from './manual/review-item.entity';
import { ModerationAnalyticsService } from './analytics/moderation-analytics.service';
import { ModerationEvent } from './analytics/moderation-event.entity';

/**
 * Registers the moderation module, exposing content safety and review services.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ReviewItem, ModerationEvent])],
  providers: [
    ContentSafetyService,
    AutoModerationService,
    ManualReviewService,
    ModerationAnalyticsService,
  ],
  exports: [
    ContentSafetyService,
    AutoModerationService,
    ManualReviewService,
    ModerationAnalyticsService,
  ],
})
export class ModerationModule {}
