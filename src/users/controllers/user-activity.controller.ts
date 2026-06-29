import { Controller, Get, Query, UseGuards, Request, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction } from '../../audit-log/enums/audit-action.enum';

/**
 * Controller for user-specific activity history and timeline.
 * Securely exposes the existing audit log system to end-users.
 */
@ApiTags('User Activity')
@Controller('users/me/activities')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserActivityController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Returns a paginated timeline of the current user's activities.
   * Enforces security by strictly filtering by the authenticated user's ID.
   */
  @Get()
  @ApiOperation({ summary: 'Get current user activity timeline' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: AuditAction,
    description: 'Filter by activity type',
  })
  @ApiResponse({ status: 200, description: 'Returns paginated activity logs' })
  async getTimeline(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('type') type?: AuditAction,
  ) {
    // Security: Strictly use user ID from the authenticated request
    const userId = req.user.id || req.user.sub;

    // Validate pagination bounds
    const sanitizedPage = Math.max(1, Number(page));
    const sanitizedLimit = Math.min(Math.max(1, Number(limit)), 100);

    return this.auditLogService.search(
      {
        userId,
        actions: type ? [type] : undefined,
      },
      sanitizedPage,
      sanitizedLimit,
    );
  }

  /**
   * Exports the current user's activity history to CSV.
   * Reuses the existing AuditExportService for consistency and security.
   */
  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename=activity-history.csv')
  @ApiOperation({ summary: 'Export current user activity to CSV' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: AuditAction,
    description: 'Filter by activity type',
  })
  @ApiResponse({ status: 200, description: 'Returns CSV file of activity logs' })
  async exportCsv(@Request() req, @Query('type') type?: AuditAction) {
    // Security: Strictly use user ID from the authenticated request
    const userId = req.user.id || req.user.sub;

    return this.auditLogService.exportToCsv({
      userId,
      actions: type ? [type] : undefined,
    });
  }
}
