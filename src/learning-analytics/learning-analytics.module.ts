/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { LearningAnalyticsService } from './learning-analytics.service';
import { LearnerBehaviorService } from './behavior/learner-behavior.service';
import { EducationalEffectivenessService } from './effectiveness/educational-effectiveness.service';
import { PredictiveLearningService } from './predictive/predictive-learning.service';
import { AnalyticsReportingService } from './reporting/analytics-reporting.service';

@Module({
  providers: [
    LearningAnalyticsService,
    LearnerBehaviorService,
    EducationalEffectivenessService,
    PredictiveLearningService,
    AnalyticsReportingService,
  ],
  exports: [LearningAnalyticsService],
})
export class LearningAnalyticsModule {}
