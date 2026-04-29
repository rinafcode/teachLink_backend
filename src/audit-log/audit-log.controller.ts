import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  IApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AuditLogService, IAuditLogSearchFilters } from './audit-log.service';
import { AuditLog } from './audit-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditAction, AuditCategory, AuditSeverity } from './enums/audit-action.enum';
import { SensitiveOperationsService } from './services/sensitive-operations.service';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditLogController {
  private readonly logger = new Logger(AuditLogController.name);

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly sensitiveOpsService: SensitiveOperationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search audit logs with filters' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'userEmail', required: false, description: 'Filter by user email' })
  @ApiQuery({
    name: 'actions',
    required: false,
    description: 'Filter by actions (comma-separated)',
  })
  @ApiQuery({
    name: 'categories',
    required: false,
    description: 'Filter by categories (comma-separated)',
  })
  @ApiQuery({
    name: 'severities',
    required: false,
    description: 'Filter by severities (comma-separated)',
  })
  @ApiQuery({ name: 'entityType', required: false, description: 'Filter by entity type' })
  @ApiQuery({ name: 'entityId', required: false, description: 'Filter by entity ID' })
  @ApiQuery({ name: 'ipAddress', required: false, description: 'Filter by IP address' })
  @ApiQuery({ name: 'sessionId', required: false, description: 'Filter by session ID' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Filter by tenant ID' })
  @ApiQuery({ name: 'apiEndpoint', required: false, description: 'Filter by API endpoint' })
  @ApiQuery({ name: 'httpMethod', required: false, description: 'Filter by HTTP method' })
  @ApiQuery({ name: 'statusCode', required: false, description: 'Filter by HTTP status code' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @IApiResponse({ status: 200, description: 'Search results' })
  async search(
    @Query('userId') userId?: string,
    @Query('userEmail') userEmail?: string,
    @Query('actions') actions?: string,
    @Query('categories') categories?: string,
    @Query('severities') severities?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('ipAddress') ipAddress?: string,
    @Query('sessionId') sessionId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('apiEndpoint') apiEndpoint?: string,
    @Query('httpMethod') httpMethod?: string,
    @Query('statusCode') statusCode?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    const filters: IAuditLogSearchFilters = {};

    if (userId) filters.userId = userId;
    if (userEmail) filters.userEmail = userEmail;
    if (actions) filters.actions = actions.split(',') as AuditAction[];
    if (categories) filters.categories = categories.split(',') as AuditCategory[];
    if (severities) filters.severities = severities.split(',') as AuditSeverity[];
    if (entityType) filters.entityType = entityType;
    if (entityId) filters.entityId = entityId;
    if (ipAddress) filters.ipAddress = ipAddress;
    if (sessionId) filters.sessionId = sessionId;
    if (tenantId) filters.tenantId = tenantId;
    if (apiEndpoint) filters.apiEndpoint = apiEndpoint;
    if (httpMethod) filters.httpMethod = httpMethod;
    if (statusCode) filters.statusCode = parseInt(statusCode, 10);
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.auditLogService.search(filters, page, limit);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent audit logs' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of logs to return',
    type: Number,
  })
  @IApiResponse({ status: 200, description: 'Recent audit logs' })
  async getRecent(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
  ): Promise<AuditLog[]> {
    return this.auditLogService.findAll(limit);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get audit logs for a specific user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of logs to return',
    type: Number,
  })
  @IApiResponse({ status: 200, description: 'User audit logs' })
  async getByUser(
    @Param('userId') userId: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
  ): Promise<AuditLog[]> {
    return this.auditLogService.findByUser(userId, limit);
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get audit logs for a specific entity' })
  @ApiParam({ name: 'entityType', description: 'Entity type (e.g., user, course)' })
  @ApiParam({ name: 'entityId', description: 'Entity ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of logs to return',
    type: Number,
  })
  @IApiResponse({ status: 200, description: 'Entity audit logs' })
  async getByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
  ): Promise<AuditLog[]> {
    return this.auditLogService.findByEntity(entityType, entityId, limit);
  }

  @Get('ip/:ipAddress')
  @ApiOperation({ summary: 'Get audit logs by IP address' })
  @ApiParam({ name: 'ipAddress', description: 'IP address' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of logs to return',
    type: Number,
  })
  @IApiResponse({ status: 200, description: 'IP audit logs' })
  async getByIpAddress(
    @Param('ipAddress') ipAddress: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
  ): Promise<AuditLog[]> {
    return this.auditLogService.findByIpAddress(ipAddress, limit);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get audit log statistics' })
  @IApiResponse({ status: 200, description: 'Statistics' })
  async getStatistics() {
    return this.auditLogService.getStatistics();
  }

  @Get('report')
  @ApiOperation({ summary: 'Generate audit report' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'End date (ISO 8601)' })
  @IApiResponse({ status: 200, description: 'Audit report' })
  async generateReport(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    if (!startDate || !endDate) {
      throw new HttpException('Start date and end date are required', HttpStatus.BAD_REQUEST);
    }

    return this.auditLogService.generateReport(new Date(startDate), new Date(endDate));
  }

  @Post('export/json')
  @ApiOperation({ summary: 'Export audit logs to JSON' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'actions', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportToJson(
    @Res() res: Response,
    @Query('userId') userId?: string,
    @Query('actions') actions?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: IAuditLogSearchFilters = {};
    if (userId) filters.userId = userId;
    if (actions) filters.actions = actions.split(',') as AuditAction[];
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const json = await this.auditLogService.exportToJson(filters);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
    res.send(json);
  }

  @Post('export/csv')
  @ApiOperation({ summary: 'Export audit logs to CSV' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'actions', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportToCsv(
    @Res() res: Response,
    @Query('userId') userId?: string,
    @Query('actions') actions?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: IAuditLogSearchFilters = {};
    if (userId) filters.userId = userId;
    if (actions) filters.actions = actions.split(',') as AuditAction[];
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const csv = await this.auditLogService.exportToCsv(filters);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.send(csv);
  }

  @Post('retention/apply')
  @ApiOperation({ summary: 'Apply retention policy (delete old logs)' })
  @IApiResponse({ status: 200, description: 'Retention policy applied' })
  async applyRetentionPolicy() {
    const deletedCount = await this.auditLogService.applyRetentionPolicy();
    return {
      message: 'Retention policy applied successfully',
      deletedCount,
    };
  }

  @Get('sensitive-operations')
  @ApiOperation({ summary: 'Get sensitive operations audit logs' })
  @ApiQuery({
    name: 'severities',
    required: false,
    description: 'Filter by severities (comma-separated)',
  })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @IApiResponse({ status: 200, description: 'Sensitive operations' })
  async getSensitiveOperations(
    @Query('severities') severities?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    const filters: IAuditLogSearchFilters = {
      severities: severities
        ? (severities.split(',') as AuditSeverity[])
        : [AuditSeverity.WARNING, AuditSeverity.CRITICAL],
    };

    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.auditLogService.search(filters, page, limit);
  }

  @Get('sensitive-operations/by-action/:action')
  @ApiOperation({ summary: 'Get sensitive operations by action type' })
  @ApiParam({ name: 'action', description: 'Audit action' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @IApiResponse({ status: 200, description: 'Sensitive operations by action' })
  async getSensitiveOperationsByAction(
    @Param('action') action: AuditAction,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
  ): Promise<AuditLog[]> {
    const filters: IAuditLogSearchFilters = {
      actions: [action],
    };

    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const result = await this.auditLogService.search(filters, 1, limit);
    return result.logs;
  }

  @Get('sensitive-operations/critical')
  @ApiOperation({ summary: 'Get critical operations' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @IApiResponse({ status: 200, description: 'Critical operations' })
  async getCriticalOperations(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
  ): Promise<AuditLog[]> {
    const filters: IAuditLogSearchFilters = {
      severities: [AuditSeverity.CRITICAL],
    };

    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const result = await this.auditLogService.search(filters, 1, limit);
    return result.logs;
  }

  @Get('sensitive-operations/user-changes/:userId')
  @ApiOperation({ summary: 'Get user-related sensitive operations' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @IApiResponse({ status: 200, description: 'User-related sensitive operations' })
  async getUserSensitiveOperations(
    @Param('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
  ): Promise<AuditLog[]> {
    const filters: IAuditLogSearchFilters = {
      entityType: 'User',
      entityId: userId,
      severities: [AuditSeverity.WARNING, AuditSeverity.CRITICAL],
    };

    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const result = await this.auditLogService.search(filters, 1, limit);
    return result.logs;
  }

  @Post('sensitive-operations/export')
  @ApiOperation({ summary: 'Export sensitive operations to CSV' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportSensitiveOperations(
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: IAuditLogSearchFilters = {
      severities: [AuditSeverity.WARNING, AuditSeverity.CRITICAL],
    };

    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    const csv = await this.auditLogService.exportToCsv(filters);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sensitive-operations.csv');
    res.send(csv);
  }
}
