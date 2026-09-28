import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ContentSafetyService } from './safety/content-safety.service';
import {
  EXTERNAL_MODERATION_PROVIDER,
  ExternalModerationProvider,
} from './safety/external-moderation.provider';
import { OpenAiModerationAdapter } from './safety/openai-moderation.adapter';
import { AutoModerationService } from './auto/auto-moderation.service';
import { ManualReviewService } from './manual/manual-review.service';
import { ReviewItem } from './manual/review-item.entity';
import { ModerationAnalyticsService } from './analytics/moderation-analytics.service';
import { ModerationEvent } from './analytics/moderation-event.entity';
import { ContentReport } from './reports/content-report.entity';
import { ContentReportingService } from './reports/content-reporting.service';
import { ContentReportsController } from './reports/content-reports.controller';
import { ReportAssignmentService } from './assignment/report-assignment.service';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Registers the moderation module, exposing content safety and review services.
 *
 * Issue #805 — wires the OpenAI adapter behind the
 * {@link EXTERNAL_MODERATION_PROVIDER} token via `useExisting`, so consumers
 * inject the interface alone. Swapping to a different provider (AWS Rekognition,
 * Perspective, …) is a one-line change in this module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewItem, ModerationEvent, ContentReport, User]),
    NotificationsModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
  ],
  controllers: [ContentReportsController],
  providers: [
    ContentSafetyService,
    OpenAiModerationAdapter,
    {
      provide: EXTERNAL_MODERATION_PROVIDER,
      useExisting: OpenAiModerationAdapter,
    },
    AutoModerationService,
    ManualReviewService,
    ModerationAnalyticsService,
    ContentReportingService,
    ReportAssignmentService,
  ],
  exports: [
    ContentSafetyService,
    {
      provide: EXTERNAL_MODERATION_PROVIDER,
      useExisting: OpenAiModerationAdapter,
    },
    AutoModerationService,
    ManualReviewService,
    ModerationAnalyticsService,
    ContentReportingService,
    ReportAssignmentService,
  ],
})
export class ModerationModule {}

// Re-export so consumers do not have to import from deep paths.
export type { ExternalModerationProvider };
