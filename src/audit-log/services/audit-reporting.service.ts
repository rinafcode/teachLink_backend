import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { AuditLog } from '../audit-log.entity';
import { AuditSeverity } from '../enums/audit-action.enum';
import { IAuditReport } from '../interfaces/audit-log.interfaces';

/**
 * Provides audit log reporting operations.
 * Responsible for generating reports and computing statistics.
 * Single Responsibility: Analyzing and reporting on audit logs.
 */
@Injectable()
export class AuditReportingService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /**
   * Generate audit report for a date range
   */
  async generateReport(startDate: Date, endDate: Date): Promise<IAuditReport> {
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
   * Get audit log statistics
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

    const [totalLogs, logsToday, logsThisWeek, logsThisMonth, criticalEvents, errorEvents] =
      await Promise.all([
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
