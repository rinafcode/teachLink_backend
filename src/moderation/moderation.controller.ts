import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { AutoModerationService } from './auto/auto-moderation.service';
import { ManualReviewService } from './manual/manual-review.service';
import { ContentSafetyService } from './safety/content-safety.service';
import { ModerationAnalyticsService } from './analytics/moderation-analytics.service';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { CreateModerationActionDto, UpdateModerationActionDto } from './dto/moderation-action.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { QueueStatus, QueuePriority } from './entities/moderation-queue.entity';
import { ReportStatus } from './entities/content-report.entity';
import { ActionType, ActionSeverity } from './entities/moderation-action.entity';

@Controller('moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModerationController {
  constructor(
    private readonly moderationService: ModerationService,
    private readonly autoModerationService: AutoModerationService,
    private readonly manualReviewService: ManualReviewService,
    private readonly contentSafetyService: ContentSafetyService,
    private readonly moderationAnalyticsService: ModerationAnalyticsService,
  ) {}

  // Content Reporting
  @Post('reports')
  @HttpCode(HttpStatus.CREATED)
  async reportContent(
    @Request() req,
    @Body() reportDto: CreateContentReportDto,
  ) {
    return this.moderationService.reportContent(req.user.id, reportDto);
  }

  @Get('reports')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getContentReports(
    @Query('contentId') contentId?: string,
    @Query('status') status?: ReportStatus,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    return this.moderationService.getContentReports(contentId, status, limit, offset);
  }

  // Moderation Queue
  @Get('queue')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getModerationQueue(
    @Query('moderatorId') moderatorId?: string,
    @Query('status') status?: QueueStatus,
    @Query('priority') priority?: QueuePriority,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    return this.moderationService.getModerationQueue(moderatorId, status, priority, limit, offset);
  }

  @Put('queue/:queueId/assign')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async assignContentToModerator(
    @Param('queueId') queueId: string,
    @Body() body: { moderatorId: string },
  ) {
    return this.moderationService.assignContentToModerator(queueId, body.moderatorId);
  }

  @Put('queue/:queueId/review')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async reviewContent(
    @Param('queueId') queueId: string,
    @Request() req,
    @Body() actionDto: CreateModerationActionDto,
  ) {
    return this.moderationService.reviewContent(queueId, req.user.id, actionDto);
  }

  // Manual Review
  @Get('manual/available')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getAvailableContent(
    @Request() req,
    @Query('limit') limit = 10,
  ) {
    return this.manualReviewService.getAvailableContent(req.user.id, limit);
  }

  @Put('manual/:queueId/assign')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async assignToModerator(
    @Param('queueId') queueId: string,
    @Request() req,
  ) {
    return this.manualReviewService.assignContentToModerator(queueId, req.user.id);
  }

  @Put('manual/:queueId/start')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async startReview(
    @Param('queueId') queueId: string,
    @Request() req,
  ) {
    return this.manualReviewService.startReview(queueId, req.user.id);
  }

  @Put('manual/:queueId/submit')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async submitReview(
    @Param('queueId') queueId: string,
    @Request() req,
    @Body() decision: {
      action: string;
      severity: string;
      reason: string;
      evidence?: Record<string, any>;
      duration?: number;
    },
  ) {
    return this.manualReviewService.submitReview(queueId, req.user.id, {
      ...decision,
      action: decision.action as ActionType,
      severity: decision.severity as ActionSeverity,
    });
  }

  @Put('manual/:queueId/escalate')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async escalateContent(
    @Param('queueId') queueId: string,
    @Request() req,
    @Body() body: { reason: string },
  ) {
    return this.manualReviewService.escalateContent(queueId, req.user.id, body.reason);
  }

  @Get('manual/history')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getReviewHistory(
    @Request() req,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    return this.manualReviewService.getReviewHistory(req.user.id, limit, offset);
  }

  @Get('manual/context/:contentId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getContentContext(@Param('contentId') contentId: string) {
    return this.manualReviewService.getContentContext(contentId);
  }

  // Content Safety
  @Get('safety/:contentId')
  async getSafetyScore(@Param('contentId') contentId: string) {
    return this.moderationService.getSafetyScore(contentId);
  }

  @Post('safety/:contentId/reanalyze')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async reanalyzeContent(
    @Param('contentId') contentId: string,
    @Body() body: { contentType: string },
  ) {
    return this.moderationService.reanalyzeContent(contentId, body.contentType);
  }

  @Get('safety/trends/:contentId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getSafetyTrends(
    @Param('contentId') contentId: string,
    @Query('days') days = 30,
  ) {
    return this.contentSafetyService.getSafetyTrends(contentId, days);
  }

  @Get('safety/categories')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getCategoryBreakdown(@Query('contentType') contentType?: string) {
    return this.contentSafetyService.getCategoryBreakdown(contentType);
  }

  // Auto Moderation
  @Post('auto/:contentId/process')
  @Roles(UserRole.ADMIN)
  async processContent(
    @Param('contentId') contentId: string,
    @Body() body: { contentType: string },
  ) {
    return this.autoModerationService.processContent(contentId, body.contentType);
  }

  @Get('auto/stats')
  @Roles(UserRole.ADMIN)
  async getAutoModerationStats() {
    return this.autoModerationService.getModerationStats();
  }

  // Analytics
  @Get('analytics/moderator/:moderatorId')
  @Roles(UserRole.ADMIN)
  async getModeratorPerformance(
    @Param('moderatorId') moderatorId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.moderationAnalyticsService.getModeratorPerformance(
      moderatorId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('analytics/system')
  @Roles(UserRole.ADMIN)
  async getSystemWideMetrics(@Query('days') days = 30) {
    return this.moderationAnalyticsService.getSystemWideMetrics(days);
  }

  @Get('analytics/accuracy')
  @Roles(UserRole.ADMIN)
  async getAccuracyMetrics(@Query('days') days = 30) {
    return this.moderationAnalyticsService.getAccuracyMetrics(days);
  }

  @Get('analytics/queue')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getQueueMetrics() {
    return this.moderationAnalyticsService.getQueueMetrics();
  }

  @Get('analytics/safety-trends')
  @Roles(UserRole.ADMIN)
  async getSafetyScoreTrends(@Query('days') days = 30) {
    return this.moderationAnalyticsService.getSafetyScoreTrends(days);
  }

  // Health Check
  @Get('health')
  async getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        moderation: 'operational',
        autoModeration: 'operational',
        manualReview: 'operational',
        contentSafety: 'operational',
        analytics: 'operational',
      },
    };
  }
} 