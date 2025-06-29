/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { EventTrackingService } from './events/event-tracking.service';
import { ReportGenerationService } from './report/report-generation.service';
import { LearningMetricsService } from './metrics/learning-metrics.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly eventTrackingService: EventTrackingService,
    private readonly reportGenerationService: ReportGenerationService,
    private readonly learningMetricsService: LearningMetricsService,
  ) {}

  // Example method combining multiple services
  async getFullAnalyticsReport(courseId: string) {
    const metrics = await this.learningMetricsService.getMetrics(courseId);
    const engagement =
      await this.reportGenerationService.generateReport('user-engagement');
    // Combine data or process further if needed
    return {
      metrics,
      engagement,
    };
  }
}
