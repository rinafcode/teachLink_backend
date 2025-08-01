// src/learning-analytics/learning-analytics.service.ts
import { Injectable } from '@nestjs/common';
import { LearnerBehaviorService } from './behavior/learner-behavior.service';
import { EducationalEffectivenessService } from './effectiveness/educational-effectiveness.service';
import { PredictiveLearningService } from './predictive/predictive-learning.service';
import { AnalyticsReportingService } from './reporting/analytics-reporting.service';

@Injectable()
export class LearningAnalyticsService {
  constructor(
    private behavior: LearnerBehaviorService,
    private effectiveness: EducationalEffectivenessService,
    private predictive: PredictiveLearningService,
    private reporting: AnalyticsReportingService,
  ) {}

  getLearnerInsights(learnerId: string) {
    return {
      behavior: this.behavior.analyzePatterns(learnerId),
      effectiveness: this.effectiveness.measureEffectiveness(learnerId),
      prediction: this.predictive.forecastSuccess(learnerId),
      recommendations: this.predictive.recommendNextSteps(learnerId),
    };
  }

  getDashboard() {
    return this.reporting.generateReport();
  }
}
