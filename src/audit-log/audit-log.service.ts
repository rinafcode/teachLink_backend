import { Injectable } from '@nestjs/common';
import { AuditAction, AuditSeverity } from './enums/audit-action.enum';
import { AuditLog } from './audit-log.entity';
import { AuditLoggerService } from './services/audit-logger.service';
import { AuditQueryService } from './services/audit-query.service';
import { AuditReportingService } from './services/audit-reporting.service';
import { AuditExportService } from './services/audit-export.service';
import {
  IAuditLogEntry,
  IAuditLogSearchFilters,
  IAuditLogSearchResult,
  IAuditReport,
} from './interfaces/audit-log.interfaces';

// Re-export interfaces for backward compatibility
export {
  IAuditLogEntry,
  IAuditLogSearchFilters,
  IAuditLogSearchResult,
  IAuditReport,
} from './interfaces/audit-log.interfaces';

/**
 * Provides audit logging operations.
 * Acts as a facade delegating to specialized services following Single Responsibility Principle.
 * - AuditLoggerService: Handles logging operations
 * - AuditQueryService: Handles search and query operations
 * - AuditReportingService: Handles report generation and statistics
 * - AuditExportService: Handles export to various formats
 */
@Injectable()
export class AuditLogService {
  constructor(
    private readonly loggerService: AuditLoggerService,
    private readonly queryService: AuditQueryService,
    private readonly reportingService: AuditReportingService,
    private readonly exportService: AuditExportService,
  ) {}

  /**
   * Log an audit event
   */
  async log(entry: IAuditLogEntry): Promise<AuditLog> {
    return this.loggerService.log(entry);
  }

  /**
   * Log authentication event
   */
  async logAuth(
    action: AuditAction,
    userId: string | null,
    userEmail: string | null,
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, unknown>,
    severity: AuditSeverity = AuditSeverity.INFO,
  ): Promise<AuditLog> {
    return this.loggerService.logAuth(action, userId, userEmail, ipAddress, userAgent, metadata, severity);
  }

  /**
   * Log data modification
   */
  async logDataChange(
    action: AuditAction,
    userId: string,
    userEmail: string,
    entityType: string,
    entityId: string,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
    ipAddress?: string,
    description?: string,
  ): Promise<AuditLog> {
    return this.loggerService.logDataChange(
      action,
      userId,
      userEmail,
      entityType,
      entityId,
      oldValues,
      newValues,
      ipAddress,
      description,
    );
  }

  /**
   * Log API access
   */
  async logApiAccess(
    userId: string | null,
    userEmail: string | null,
    apiEndpoint: string,
    httpMethod: string,
    statusCode: number,
    responseTimeMs: number,
    ipAddress: string,
    userAgent: string,
    requestId?: string,
  ): Promise<AuditLog> {
    return this.loggerService.logApiAccess(
      userId,
      userEmail,
      apiEndpoint,
      httpMethod,
      statusCode,
      responseTimeMs,
      ipAddress,
      userAgent,
      requestId,
    );
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    action: AuditAction,
    userId: string | null,
    userEmail: string | null,
    ipAddress: string,
    userAgent: string,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<AuditLog> {
    return this.loggerService.logSecurityEvent(action, userId, userEmail, ipAddress, userAgent, description, metadata);
  }

  /**
   * Search audit logs with filters
   */
  async search(
    filters: IAuditLogSearchFilters,
    page: number = 1,
    limit: number = 50,
  ): Promise<IAuditLogSearchResult> {
    return this.queryService.search(filters, page, limit);
  }

  /**
   * Find all logs (with limit)
   */
  async findAll(limit: number = 100): Promise<AuditLog[]> {
    return this.queryService.findAll(limit);
  }

  /**
   * Find logs by user
   */
  async findByUser(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return this.queryService.findByUser(userId, limit);
  }

  /**
   * Find logs by action
   */
  async findByAction(action: AuditAction, limit: number = 100): Promise<AuditLog[]> {
    return this.queryService.findByAction(action, limit);
  }

  /**
   * Find logs by entity
   */
  async findByEntity(
    entityType: string,
    entityId: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    return this.queryService.findByEntity(entityType, entityId, limit);
  }

  /**
   * Find logs by IP address
   */
  async findByIpAddress(ipAddress: string, limit: number = 100): Promise<AuditLog[]> {
    return this.queryService.findByIpAddress(ipAddress, limit);
  }

  /**
   * Find logs by date range
   */
  async findByDateRange(startDate: Date, endDate: Date, limit: number = 1000): Promise<AuditLog[]> {
    return this.queryService.findByDateRange(startDate, endDate, limit);
  }

  /**
   * Generate audit report
   */
  async generateReport(startDate: Date, endDate: Date): Promise<IAuditReport> {
    return this.reportingService.generateReport(startDate, endDate);
  }

  /**
   * Apply retention policy - delete old logs
   */
  async applyRetentionPolicy(): Promise<number> {
    return this.loggerService.applyRetentionPolicy();
  }

  /**
   * Export logs to JSON
   */
  async exportToJson(filters: IAuditLogSearchFilters): Promise<string> {
    return this.exportService.exportToJson(filters);
  }

  /**
   * Export logs to CSV
   */
  async exportToCsv(filters: IAuditLogSearchFilters): Promise<string> {
    return this.exportService.exportToCsv(filters);
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    totalLogs: number;
    logsToday: number;
    logsThisWeek: number;
    logsThisMonth: number;
    criticalEvents: number;
    errorEvents: number;
  }> {
    return this.reportingService.getStatistics();
  }

