/* eslint-disable prettier/prettier */
import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { EventTrackingService } from './events/event-tracking.service';
import { ReportGenerationService } from './report/report-generation.service';
import { LearningMetricsService } from './metrics/learning-metrics.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly eventTrackingService: EventTrackingService,
    private readonly reportGenerationService: ReportGenerationService,
    private readonly learningMetricsService: LearningMetricsService,
  ) {}

  // Track user event
  @Post('track-event')
  @ApiOperation({ summary: 'Track a user event' })
  @ApiResponse({ status: 201, description: 'Event tracked successfully.' })
  async trackEvent(@Body() eventData: any) {
    return this.eventTrackingService.trackEvent(eventData);
  }

  // Get report data (for dashboard or export)
  @Get('reports')
  @ApiOperation({ summary: 'Get analytics report data' })
  @ApiResponse({ status: 200, description: 'Report data returned successfully.' })
  async getReport(
    @Query('type') type: string,
    @Query('format') format: string = 'json',
  ) {
    return this.reportGenerationService.generateReport(type, format);
  }

  // Get learning metrics (e.g., course success rates)
  @Get('learning-metrics')
  @ApiOperation({ summary: 'Get learning metrics' })
  @ApiResponse({ status: 200, description: 'Learning metrics returned successfully.' })
  async getLearningMetrics(@Query('courseId') courseId: string) {
    return this.learningMetricsService.getMetrics(courseId);
  }
}
