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

// ─── Option objects ────────────────────────────────────────────────────────────
//
// Positional argument lists longer than 3 parameters are error-prone: callers
// must count positions and silently pass the wrong value if the order changes.
// Option objects make call sites self-documenting and allow optional fields to
// be omitted without placeholder `undefined` arguments.

export interface LogAuthOptions {
  action: AuditAction;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
}

export interface LogDataChangeOptions {
  action: AuditAction;
  userId: string;
  userEmail: string;
  entityType: string;
  entityId: string;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  ipAddress?: string;
  description?: string;
}

export interface LogApiAccessOptions {
  userId: string | null;
  userEmail: string | null;
  apiEndpoint: string;
  httpMethod: string;
  statusCode: number;
  responseTimeMs: number;
  ipAddress: string;
  userAgent: string;
  requestId?: string;
}

export interface LogSecurityEventOptions {
  action: AuditAction;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string;
  userAgent: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface AuditStatistics {
  totalLogs: number;
  logsToday: number;
  logsThisWeek: number;
  logsThisMonth: number;
  criticalEvents: number;
  errorEvents: number;
}

/**
 * Facade that routes audit operations to specialised sub-services.
 *
 * Responsibilities of sub-services:
 *   AuditLoggerService    — write operations (log, retention)
 *   AuditQueryService     — read operations (search, find*)
 *   AuditReportingService — aggregations and statistics
 *   AuditExportService    — serialisation (JSON, CSV)
 */
@Injectable()
export class AuditLogService {
  constructor(
    private readonly loggerService: AuditLoggerService,
    private readonly queryService: AuditQueryService,
    private readonly reportingService: AuditReportingService,
    private readonly exportService: AuditExportService,
  ) {}

  // ── Write ──────────────────────────────────────────────────────────────────

  log(entry: IAuditLogEntry): Promise<AuditLog> {
    return this.loggerService.log(entry);
  }

  logAuth(options: LogAuthOptions): Promise<AuditLog> {
    return this.loggerService.logAuth(
      options.action,
      options.userId,
      options.userEmail,
      options.ipAddress,
      options.userAgent,
      options.metadata,
      options.severity ?? AuditSeverity.INFO,
    );
  }

  logDataChange(options: LogDataChangeOptions): Promise<AuditLog> {
    return this.loggerService.logDataChange(
      options.action,
      options.userId,
      options.userEmail,
      options.entityType,
      options.entityId,
      options.oldValues,
      options.newValues,
      options.ipAddress,
      options.description,
    );
  }

  logApiAccess(options: LogApiAccessOptions): Promise<AuditLog> {
    return this.loggerService.logApiAccess(
      options.userId,
      options.userEmail,
      options.apiEndpoint,
      options.httpMethod,
      options.statusCode,
      options.responseTimeMs,
      options.ipAddress,
      options.userAgent,
      options.requestId,
    );
  }

  logSecurityEvent(options: LogSecurityEventOptions): Promise<AuditLog> {
    return this.loggerService.logSecurityEvent(
      options.action,
      options.userId,
      options.userEmail,
      options.ipAddress,
      options.userAgent,
      options.description,
      options.metadata,
    );
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  search(filters: IAuditLogSearchFilters, page = 1, limit = 50): Promise<IAuditLogSearchResult> {
    return this.queryService.search(filters, page, limit);
  }

  findAll(limit = 100): Promise<AuditLog[]> {
    return this.queryService.findAll(limit);
  }

  findByUser(userId: string, limit = 100): Promise<AuditLog[]> {
    return this.queryService.findByUser(userId, limit);
  }

  findByAction(action: AuditAction, limit = 100): Promise<AuditLog[]> {
    return this.queryService.findByAction(action, limit);
  }

  findByEntity(entityType: string, entityId: string, limit = 100): Promise<AuditLog[]> {
    return this.queryService.findByEntity(entityType, entityId, limit);
  }

  findByIpAddress(ipAddress: string, limit = 100): Promise<AuditLog[]> {
    return this.queryService.findByIpAddress(ipAddress, limit);
  }

  findByDateRange(startDate: Date, endDate: Date, limit = 1000): Promise<AuditLog[]> {
    return this.queryService.findByDateRange(startDate, endDate, limit);
  }

  // ── Reporting ──────────────────────────────────────────────────────────────

  generateReport(startDate: Date, endDate: Date): Promise<IAuditReport> {
    return this.reportingService.generateReport(startDate, endDate);
  }

  getStatistics(): Promise<AuditStatistics> {
    return this.reportingService.getStatistics();
  }

  // ── Maintenance ────────────────────────────────────────────────────────────

  applyRetentionPolicy(): Promise<number> {
    return this.loggerService.applyRetentionPolicy();
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  exportToJson(filters: IAuditLogSearchFilters): Promise<string> {
    return this.exportService.exportToJson(filters);
  }

  exportToCsv(filters: IAuditLogSearchFilters): Promise<string> {
    return this.exportService.exportToCsv(filters);
  }
}
