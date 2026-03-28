import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan, In, Brackets, WhereExpressionBuilder } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditAction, AuditSeverity, AuditCategory } from './enums/audit-action.enum';
import { ConfigService } from '@nestjs/config';

export interface AuditLogEntry {
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  category: AuditCategory;
  severity?: AuditSeverity;
  entityType?: string;
  entityId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  apiEndpoint?: string;
  httpMethod?: string;
  statusCode?: number;
  responseTimeMs?: number;
  tenantId?: string;
}

export interface AuditLogSearchFilters {
  userId?: string;
  userEmail?: string;
  actions?: AuditAction[];
  categories?: AuditCategory[];
  severities?: AuditSeverity[];
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  sessionId?: string;
  tenantId?: string;
  startDate?: Date;
  endDate?: Date;
  apiEndpoint?: string;
  httpMethod?: string;
  statusCode?: number;
}

export interface AuditLogSearchResult {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditReport {
  period: { start: Date; end: Date };
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsByAction: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  topUsers: Array<{ userId: string; userEmail: string; count: number }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  failedActions: Array<{ action: string; count: number }>;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly retentionDays: number;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly configService: ConfigService,
  ) {
    this.retentionDays = this.configService.get<number>('AUDIT_LOG_RETENTION_DAYS', 365);
  }

  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<AuditLog> {
    const retentionUntil = new Date();
    retentionUntil.setDate(retentionUntil.getDate() + this.retentionDays);

    const log = this.auditRepo.create({
      ...entry,
      severity: entry.severity || AuditSeverity.INFO,
      retentionUntil,
    });

    try {
      const saved = await this.auditRepo.save(log);
      this.logger.debug(`Audit log created: ${entry.action} - ${entry.description || 'no description'}`);
      return saved;
    } catch (error) {
      this.logger.error('Failed to create audit log:', error);
      // Don't throw - audit logging should not break main functionality
      return log;
    }
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
    return this.log({
      userId: userId || undefined,
      userEmail: userEmail || undefined,
      action,
      category: AuditCategory.AUTHENTICATION,
      severity,
      ipAddress,
      userAgent,
      metadata,
    });
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
    return this.log({
      userId,
      userEmail,
      action,
      category: AuditCategory.DATA_MODIFICATION,
      severity: AuditSeverity.INFO,
      entityType,
      entityId,
      description,
      oldValues,
      newValues,
      ipAddress,
    });
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
    const severity = statusCode >= 500 ? AuditSeverity.ERROR :
                     statusCode >= 400 ? AuditSeverity.WARNING :
                     AuditSeverity.INFO;

    return this.log({
      userId: userId || undefined,
      userEmail: userEmail || undefined,
      action: AuditAction.API_CALLED,
      category: AuditCategory.DATA_ACCESS,
      severity,
      apiEndpoint,
      httpMethod,
      statusCode,
      responseTimeMs,
      ipAddress,
      userAgent,
      requestId,
    });
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
    return this.log({
      userId: userId || undefined,
      userEmail: userEmail || undefined,
      action,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.WARNING,
      ipAddress,
      userAgent,
      description,
      metadata,
    });
  }

  /**
   * Search audit logs with filters
   */
  async search(
    filters: AuditLogSearchFilters,
    page: number = 1,
    limit: number = 50,
  ): Promise<AuditLogSearchResult> {
    const queryBuilder = this.auditRepo.createQueryBuilder('audit');

    // Apply filters
    if (filters.userId) {
      queryBuilder.andWhere('audit.userId = :userId', { userId: filters.userId });
    }

    if (filters.userEmail) {
      queryBuilder.andWhere('audit.userEmail = :userEmail', { userEmail: filters.userEmail });
    }

    if (filters.actions && filters.actions.length > 0) {
      queryBuilder.andWhere('audit.action IN (:...actions)', { actions: filters.actions });
    }

    if (filters.categories && filters.categories.length > 0) {
      queryBuilder.andWhere('audit.category IN (:...categories)', { categories: filters.categories });
    }

    if (filters.severities && filters.severities.length > 0) {
      queryBuilder.andWhere('audit.severity IN (:...severities)', { severities: filters.severities });
    }

    if (filters.entityType) {
      queryBuilder.andWhere('audit.entityType = :entityType', { entityType: filters.entityType });
    }

    if (filters.entityId) {
      queryBuilder.andWhere('audit.entityId = :entityId', { entityId: filters.entityId });
    }

    if (filters.ipAddress) {
      queryBuilder.andWhere('audit.ipAddress = :ipAddress', { ipAddress: filters.ipAddress });
    }

    if (filters.sessionId) {
      queryBuilder.andWhere('audit.sessionId = :sessionId', { sessionId: filters.sessionId });
    }

    if (filters.tenantId) {
      queryBuilder.andWhere('audit.tenantId = :tenantId', { tenantId: filters.tenantId });
    }

    if (filters.apiEndpoint) {
      queryBuilder.andWhere('audit.apiEndpoint LIKE :apiEndpoint', {
        apiEndpoint: `%${filters.apiEndpoint}%`,
      });
    }

    if (filters.httpMethod) {
      queryBuilder.andWhere('audit.httpMethod = :httpMethod', { httpMethod: filters.httpMethod });
    }

    if (filters.statusCode) {
      queryBuilder.andWhere('audit.statusCode = :statusCode', { statusCode: filters.statusCode });
    }

    if (filters.startDate && filters.endDate) {
      queryBuilder.andWhere('audit.timestamp BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    } else if (filters.startDate) {
      queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate: filters.startDate });
    } else if (filters.endDate) {
      queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate: filters.endDate });
    }

    // Order by timestamp desc
    queryBuilder.orderBy('audit.timestamp', 'DESC');

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const logs = await queryBuilder.getMany();

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find all logs (with limit)
   */
  async findAll(limit: number = 100): Promise<AuditLog[]> {
    return this.auditRepo.find({
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Find logs by user
   */
  async findByUser(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Find logs by action
   */
  async findByAction(action: AuditAction, limit: number = 100): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { action },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Find logs by entity
   */
  async findByEntity(entityType: string, entityId: string, limit: number = 100): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { entityType, entityId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Find logs by IP address
   */
  async findByIpAddress(ipAddress: string, limit: number = 100): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: { ipAddress },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Find logs by date range
   */
  async findByDateRange(startDate: Date, endDate: Date, limit: number = 1000): Promise<AuditLog[]> {
    return this.auditRepo.find({
      where: {
        timestamp: Between(startDate, endDate),
      },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Generate audit report
   */
  async generateReport(startDate: Date, endDate: Date): Promise<AuditReport> {
    const queryBuilder = this.auditRepo.createQueryBuilder('audit');
    queryBuilder.where('audit.timestamp BETWEEN :startDate AND :endDate', {
      startDate,
      endDate,
    });

    const totalEvents = await queryBuilder.getCount();

    // Events by category
    const categoryStats = await this.auditRepo
      .createQueryBuilder('audit')
      .select('audit.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('audit.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('audit.category')
      .getRawMany();

    const eventsByCategory: Record<string, number> = {};
    categoryStats.forEach((stat) => {
      eventsByCategory[stat.category] = parseInt(stat.count, 10);
    });

    // Events by action
    const actionStats = await this.auditRepo
      .createQueryBuilder('audit')
      .select('audit.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('audit.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('audit.action')
      .getRawMany();

    const eventsByAction: Record<string, number> = {};
    actionStats.forEach((stat) => {
      eventsByAction[stat.action] = parseInt(stat.count, 10);
    });

    // Events by severity
    const severityStats = await this.auditRepo
      .createQueryBuilder('audit')
      .select('audit.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('audit.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('audit.severity')
      .getRawMany();

    const eventsBySeverity: Record<string, number> = {};
    severityStats.forEach((stat) => {
      eventsBySeverity[stat.severity] = parseInt(stat.count, 10);
    });

    // Top users
    const topUsers = await this.auditRepo
      .createQueryBuilder('audit')
      .select('audit.userId', 'userId')
      .addSelect('audit.userEmail', 'userEmail')
      .addSelect('COUNT(*)', 'count')
      .where('audit.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('audit.userId IS NOT NULL')
      .groupBy('audit.userId')
      .addGroupBy('audit.userEmail')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    // Top endpoints
    const topEndpoints = await this.auditRepo
      .createQueryBuilder('audit')
      .select('audit.apiEndpoint', 'endpoint')
      .addSelect('COUNT(*)', 'count')
      .where('audit.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('audit.apiEndpoint IS NOT NULL')
      .groupBy('audit.apiEndpoint')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    // Failed actions (status code >= 400)
    const failedActions = await this.auditRepo
      .createQueryBuilder('audit')
      .select('audit.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('audit.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('audit.statusCode >= 400')
      .groupBy('audit.action')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      period: { start: startDate, end: endDate },
      totalEvents,
      eventsByCategory,
      eventsByAction,
      eventsBySeverity,
      topUsers: topUsers.map((u) => ({
        userId: u.userId,
        userEmail: u.userEmail || 'Unknown',
        count: parseInt(u.count, 10),
      })),
      topEndpoints: topEndpoints.map((e) => ({
        endpoint: e.endpoint,
        count: parseInt(e.count, 10),
      })),
      failedActions: failedActions.map((f) => ({
        action: f.action,
        count: parseInt(f.count, 10),
      })),
    };
  }

  /**
   * Apply retention policy - delete old logs
   */
  async applyRetentionPolicy(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const result = await this.auditRepo
      .createQueryBuilder()
      .delete()
      .where('timestamp < :cutoffDate', { cutoffDate })
      .orWhere('retentionUntil < NOW()')
      .execute();

    const deletedCount = result.affected || 0;
    this.logger.log(`Applied retention policy: deleted ${deletedCount} old audit logs`);
    return deletedCount;
  }

  /**
   * Export logs to JSON
   */
  async exportToJson(filters: AuditLogSearchFilters): Promise<string> {
    const { logs } = await this.search(filters, 1, 10000);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Export logs to CSV
   */
  async exportToCsv(filters: AuditLogSearchFilters): Promise<string> {
    const { logs } = await this.search(filters, 1, 10000);

    const headers = [
      'timestamp',
      'userId',
      'userEmail',
      'action',
      'category',
      'severity',
      'entityType',
      'entityId',
      'description',
      'ipAddress',
      'userAgent',
      'apiEndpoint',
      'httpMethod',
      'statusCode',
    ];

    const rows = logs.map((log) => [
      log.timestamp.toISOString(),
      log.userId || '',
      log.userEmail || '',
      log.action,
      log.category,
      log.severity,
      log.entityType || '',
      log.entityId || '',
      log.description || '',
      log.ipAddress || '',
      log.userAgent || '',
      log.apiEndpoint || '',
      log.httpMethod || '',
      log.statusCode || '',
    ]);

    const escapeCsv = (value: string | number) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    return csvContent;
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
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalLogs,
      logsToday,
      logsThisWeek,
      logsThisMonth,
      criticalEvents,
      errorEvents,
    ] = await Promise.all([
      this.auditRepo.count(),
      this.auditRepo.count({ where: { timestamp: MoreThanOrEqual(today) } }),
      this.auditRepo.count({ where: { timestamp: MoreThanOrEqual(weekAgo) } }),
      this.auditRepo.count({ where: { timestamp: MoreThanOrEqual(monthAgo) } }),
      this.auditRepo.count({ where: { severity: AuditSeverity.CRITICAL } }),
      this.auditRepo.count({ where: { severity: AuditSeverity.ERROR } }),
    ]);

    return {
      totalLogs,
      logsToday,
      logsThisWeek,
      logsThisMonth,
      criticalEvents,
      errorEvents,
    };
  }
}

// Helper function for date comparison
function MoreThanOrEqual(date: Date) {
  return MoreThan(date);
}
