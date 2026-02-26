import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationService } from './moderation.service';
import { AutoModerationService } from './auto/auto-moderation.service';
import { ManualReviewService } from './manual/manual-review.service';
import { ContentSafetyService } from './safety/content-safety.service';
import { ModerationAnalyticsService } from './analytics/moderation-analytics.service';
import { ReviewItem } from './manual/review-item.entity';
import { ModerationEvent } from './analytics/moderation-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReviewItem, ModerationEvent])],
  providers: [
    ModerationService,
    AutoModerationService,
    ManualReviewService,
    ContentSafetyService,
    ModerationAnalyticsService,
  ],
  exports: [ModerationService],
})
export class ModerationModule {}
