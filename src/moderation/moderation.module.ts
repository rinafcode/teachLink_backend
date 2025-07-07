import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationService } from './moderation.service';
import { AutoModerationService } from './auto/auto-moderation.service';
import { ManualReviewService } from './manual/manual-review.service';
import { ContentSafetyService } from './safety/content-safety.service';
import { ModerationAnalyticsService } from './analytics/moderation-analytics.service';
import { ModerationController } from './moderation.controller';
import { ContentReport } from './entities/content-report.entity';
import { ModerationQueue } from './entities/moderation-queue.entity';
import { ModerationAction } from './entities/moderation-action.entity';
import { SafetyScore } from './entities/safety-score.entity';
import { ModerationAnalytics } from './entities/moderation-analytics.entity';
import { MediaModule } from '../media/media.module';
import { LessonsModule } from '../courses/lessons/lessons.module';
import { CoursesModule } from '../courses/courses.module';
import { ModulesModule } from '../courses/modules/modules.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentReport,
      ModerationQueue,
      ModerationAction,
      SafetyScore,
      ModerationAnalytics,
    ]),
    MediaModule,
    LessonsModule,
    CoursesModule,
    ModulesModule,
    UsersModule,
  ],
  controllers: [ModerationController],
  providers: [
    ModerationService,
    AutoModerationService,
    ManualReviewService,
    ContentSafetyService,
    ModerationAnalyticsService,
  ],
  exports: [
    ModerationService,
    AutoModerationService,
    ManualReviewService,
    ContentSafetyService,
    ModerationAnalyticsService,
  ],
})
export class ModerationModule {} 