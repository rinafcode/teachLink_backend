import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  IStructuredLog,
  ILogQuery,
  ILogSearchResult,
  LogLevel,
} from '../interfaces/observability.interfaces';
import { LogShipperService } from '../../common/services/log-shipper.service';

/**
 * Log Aggregation Service
 * Centralized log storage and search functionality.
 * In-memory store acts as a hot buffer; every entry is also forwarded
 * to Elasticsearch via LogShipperService for persistent, searchable storage.
 */
@Injectable()
export class LogAggregationService {
  private readonly logger = new Logger(LogAggregationService.name);
  private logs: IStructuredLog[] = [];
  private readonly MAX_LOGS = 10000; // In-memory limit

  constructor(@Optional() private readonly logShipper?: LogShipperService) {}

  /**
   * Store a log entry
   */
  async storeLogs(log: IStructuredLog): Promise<void> {
    this.logs.push(log);

    // Maintain size limit (FIFO)
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    // In production, send to external log aggregation service
    // Examples: Elasticsearch, CloudWatch, Datadog, etc.
    await this.sendToExternalService(log);
  }

  /**
   * Search logs with filters
   */
  async searchLogs(query: ILogQuery): Promise<ILogSearchResult> {
    let filteredLogs = [...this.logs];

    // Apply filters
    if (query.level) {
      filteredLogs = filteredLogs.filter((log) => log.level === query.level);
    }
    /**
     * Get logs by correlation ID (trace all related logs)
     */
    async getLogsByCorrelationId(correlationId: string): Promise<StructuredLog[]> {
        return this.logs.filter((log) => log.context.correlationId === correlationId);
    }
    /**
     * Get logs by trace ID
     */
    async getLogsByTraceId(traceId: string): Promise<StructuredLog[]> {
        return this.logs.filter((log) => log.context.traceId === traceId);
    }
    /**
     * Get error logs
     */
    async getErrorLogs(limit: number = 100): Promise<StructuredLog[]> {
        return this.logs
            .filter((log) => log.level === LogLevel.ERROR || log.level === LogLevel.FATAL)
            .slice(-limit)
            .reverse();
    }
    /**
     * Get logs by user
     */
    async getLogsByUser(userId: string, limit: number = 100): Promise<StructuredLog[]> {
        return this.logs
            .filter((log) => log.context.userId === userId)
            .slice(-limit)
            .reverse();
    }
    /**
     * Get log statistics
     */
    async getLogStatistics(timeRange?: {
        start: Date;
        end: Date;
    }) {
        let logsToAnalyze = this.logs;
        if (timeRange) {
            logsToAnalyze = this.logs.filter((log) => log.context.timestamp >= timeRange.start && log.context.timestamp <= timeRange.end);
        }
        const stats = {
            total: logsToAnalyze.length,
            byLevel: {
                debug: 0,
                info: 0,
                warn: 0,
                error: 0,
                fatal: 0,
            },
            byService: {} as Record<string, number>,
            errorRate: 0,
            avgDuration: 0,
        };
        let totalDuration = 0;
        let durationCount = 0;
        logsToAnalyze.forEach((log) => {
            // Count by level
            stats.byLevel[log.level]++;
            // Count by service
            const service = log.context.service;
            stats.byService[service] = (stats.byService[service] || 0) + 1;
            // Calculate duration stats
            if (log.duration) {
                totalDuration += log.duration;
                durationCount++;
            }
        });
        // Calculate error rate
        const errorCount = stats.byLevel.error + stats.byLevel.fatal;
        stats.errorRate = stats.total > 0 ? (errorCount / stats.total) * 100 : 0;
        // Calculate average duration
        stats.avgDuration = durationCount > 0 ? totalDuration / durationCount : 0;
        return stats;
    }
    /**
     * Clear old logs
     */
    async clearOldLogs(olderThan: Date): Promise<number> {
        const initialCount = this.logs.length;
        this.logs = this.logs.filter((log) => log.context.timestamp > olderThan);
        const removed = initialCount - this.logs.length;
        this.logger.log(`Cleared ${removed} old logs`);
        return removed;
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.context.timestamp.getTime() - a.context.timestamp.getTime());

    // Pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);

    return {
      logs: paginatedLogs,
      total: filteredLogs.length,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    };
  }

  /**
   * Get logs by correlation ID (trace all related logs)
   */
  async getLogsByCorrelationId(correlationId: string): Promise<IStructuredLog[]> {
    return this.logs.filter((log) => log.context.correlationId === correlationId);
  }

  /**
   * Get logs by trace ID
   */
  async getLogsByTraceId(traceId: string): Promise<IStructuredLog[]> {
    return this.logs.filter((log) => log.context.traceId === traceId);
  }

  /**
   * Get error logs
   */
  async getErrorLogs(limit: number = 100): Promise<IStructuredLog[]> {
    return this.logs
      .filter((log) => log.level === LogLevel.ERROR || log.level === LogLevel.FATAL)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get logs by user
   */
  async getLogsByUser(userId: string, limit: number = 100): Promise<IStructuredLog[]> {
    return this.logs
      .filter((log) => log.context.userId === userId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get log statistics
   */
  async getLogStatistics(timeRange?: { start: Date; end: Date }) {
    let logsToAnalyze = this.logs;

    if (timeRange) {
      logsToAnalyze = this.logs.filter(
        (log) => log.context.timestamp >= timeRange.start && log.context.timestamp <= timeRange.end,
      );
    }

    const stats = {
      total: logsToAnalyze.length,
      byLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        fatal: 0,
      },
      byService: {} as Record<string, number>,
      errorRate: 0,
      avgDuration: 0,
    };

    let totalDuration = 0;
    let durationCount = 0;

    logsToAnalyze.forEach((log) => {
      // Count by level
      stats.byLevel[log.level]++;

      // Count by service
      const service = log.context.service;
      stats.byService[service] = (stats.byService[service] || 0) + 1;

      // Calculate duration stats
      if (log.duration) {
        totalDuration += log.duration;
        durationCount++;
      }
    });

    // Calculate error rate
    const errorCount = stats.byLevel.error + stats.byLevel.fatal;
    stats.errorRate = stats.total > 0 ? (errorCount / stats.total) * 100 : 0;

    // Calculate average duration
    stats.avgDuration = durationCount > 0 ? totalDuration / durationCount : 0;

    return stats;
  }

  /**
   * Clear old logs
   */
  async clearOldLogs(olderThan: Date): Promise<number> {
    const initialCount = this.logs.length;
    this.logs = this.logs.filter((log) => log.context.timestamp > olderThan);
    const removed = initialCount - this.logs.length;
    this.logger.log(`Cleared ${removed} old logs`);
    return removed;
  }

  /**
   * Export logs for analysis
   */
  async exportLogs(query: ILogQuery): Promise<string> {
    const result = await this.searchLogs(query);
    return JSON.stringify(result.logs, null, 2);
  }

  /**
   * Ship a log entry to Elasticsearch via LogShipperService.
   * Fire-and-forget — never throws so in-memory storage is never blocked.
   */
  private async sendToExternalService(log: IStructuredLog): Promise<void> {
    if (!this.logShipper) return;

    const document: Record<string, unknown> = {
      '@timestamp': log.context.timestamp.toISOString(),
      level: log.level,
      message: log.message,
      service: log.context.service,
      environment: log.context.environment,
      correlationId: log.context.correlationId,
      traceId: log.context.traceId,
      spanId: log.context.spanId,
      userId: log.context.userId,
      requestId: log.context.requestId,
      duration: log.duration,
      tags: log.tags,
      ...(log.error && {
        error: {
          name: log.error.name,
          message: log.error.message,
          stack: log.error.stack,
          code: log.error.code,
          statusCode: log.error.statusCode,
        },
      }),
      ...(log.context.metadata && { metadata: log.context.metadata }),
    };

    this.logShipper.ship(document);
  }

  /**
   * Get recent logs
   */
  async getRecentLogs(limit: number = 100): Promise<IStructuredLog[]> {
    return this.logs.slice(-limit).reverse();
  }

  /**
   * Count logs by criteria
   */
  async countLogs(query: Partial<ILogQuery>): Promise<number> {
    const result = await this.searchLogs(query as ILogQuery);
    return result.total;
  }

  /**
   * Get unique correlation IDs
   */
  async getUniqueCorrelationIds(limit: number = 100): Promise<string[]> {
    const correlationIds = new Set<string>();
    this.logs.slice(-limit * 10).forEach((log) => {
      if (log.context.correlationId) {
        correlationIds.add(log.context.correlationId);
      }
    });
    return Array.from(correlationIds).slice(0, limit);
  }
}
