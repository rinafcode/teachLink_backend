/* eslint-disable prettier/prettier */
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { EventTrackingService } from './events/event-tracking.service';
import { ReportGenerationService } from './report/report-generation.service';
import { LearningMetricsService } from './metrics/learning-metrics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly eventTrackingService: EventTrackingService,
    private readonly reportGenerationService: ReportGenerationService,
    private readonly learningMetricsService: LearningMetricsService,
  ) {}

  // Track user event
  @Post('track-event')
  async trackEvent(@Body() eventData: any) {
    return this.eventTrackingService.trackEvent(eventData);
  }

  // Get report data (for dashboard or export)
  @Get('reports')
  async getReport(
    @Query('type') type: string,
    @Query('format') format: string = 'json',
  ) {
    return this.reportGenerationService.generateReport(type, format);
  }

  // Get learning metrics (e.g., course success rates)
  @Get('learning-metrics')
  async getLearningMetrics(@Query('courseId') courseId: string) {
    return this.learningMetricsService.getMetrics(courseId);
  }
}
