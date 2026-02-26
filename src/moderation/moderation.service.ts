import { Injectable } from '@nestjs/common';
import { AutoModerationService } from './auto/auto-moderation.service';
import { ManualReviewService } from './manual/manual-review.service';
import { ContentSafetyService } from './safety/content-safety.service';
import { ModerationAnalyticsService } from './analytics/moderation-analytics.service';

@Injectable()
export class ModerationService {
  constructor(
    private readonly autoModeration: AutoModerationService,
    private readonly manualReview: ManualReviewService,
    private readonly safetyService: ContentSafetyService,
    private readonly analytics: ModerationAnalyticsService,
  ) {}

  async moderateContent(content: string) {
    const autoResult = await this.autoModeration.analyze(content);
    const safetyScore = this.safetyService.scoreContent(content);

    if (autoResult.flagged || safetyScore > 0.7) {
      await this.manualReview.enqueue(content, safetyScore);
      this.analytics.logModerationEvent(content, safetyScore, 'flagged');
      return { status: 'flagged', safetyScore };
    }

    this.analytics.logModerationEvent(content, safetyScore, 'approved');
    return { status: 'approved', safetyScore };
  }
}
