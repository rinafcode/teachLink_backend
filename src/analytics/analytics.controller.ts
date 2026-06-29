import { Controller, Post, Body, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { CreateEventDto } from './dto/create-event.dto';
import { AnalyticsEvent, EventType } from './entities/event.entity';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Track an analytics event
   */
  @Post('events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Track an analytics event' })
  @ApiResponse({ status: 201, description: 'Event tracked successfully' })
  async trackEvent(
    @Body() dto: CreateEventDto,
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    await this.analyticsService.trackEvent({
      ...dto,
      eventType: (dto as any).eventType || EventType.CUSTOM,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return { success: true };
  }

  @Post('event')
  @ApiOperation({ summary: 'Track a feature event (compatibility endpoint)' })
  @ApiResponse({ status: 201, description: 'Feature event tracked successfully' })
  async trackEventCompatibility(
    @Body() dto: CreateEventDto,
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    await this.analyticsService.trackEvent({
      ...dto,
      eventType: EventType.CUSTOM,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return { success: true };
  }

  /**
   * Get analytics events with filtering
   */
  @Get('events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get analytics events' })
  @ApiResponse({
    status: 200,
    description: 'Events retrieved',
    schema: { example: { events: [], total: 0 } },
  })
  async getEvents(
    @Query('eventType') eventType?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ events: AnalyticsEvent[]; total: number }> {
    return this.analyticsService.getEvents({
      eventType: eventType
        ? (EventType[eventType as keyof typeof EventType] as EventType)
        : undefined,
      category,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  /**
   * Get analytics summary
   */
  @Get('summary')
  @ApiOperation({ summary: 'Get analytics summary' })
  @ApiResponse({
    status: 200,
    description: 'Analytics summary',
    schema: {
      example: {
        totalEvents: 1000,
        eventsByType: { signup: 100, login: 500 },
        eventsByCategory: { user: 600, course: 400 },
        topActions: [{ action: 'login', count: 500 }],
      },
    },
  })
  async getAnalyticsSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.analyticsService.getAnalyticsSummary(start, end);
  }
}
