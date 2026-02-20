import { Injectable, Logger } from '@nestjs/common';
import {
  StructuredLog,
  LogQuery,
  LogSearchResult,
  LogLevel,
} from '../interfaces/observability.interfaces';

/**
 * Log Aggregation Service
 * Centralized log storage and search functionality
 */
@Injectable()
export class LogAggregationService {
  private readonly logger = new Logger(LogAggregationService.name);
  private logs: StructuredLog[] = [];
  private readonly MAX_LOGS = 10000; // In-memory limit

  /**
   * Store a log entry
   */
  async storeLogs(log: StructuredLog): Promise<void> {
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
  async searchLogs(query: LogQuery): Promise<LogSearchResult> {
    let filteredLogs = [...this.logs];

    // Apply filters
    if (query.level) {
      filteredLogs = filteredLogs.filter((log) => log.level === query.level);
    }

    if (query.service) {
      filteredLogs = filteredLogs.filter(
        (log) => log.context.service === query.service,
      );
    }

    if (query.correlationId) {
      filteredLogs = filteredLogs.filter(
        (log) => log.context.correlationId === query.correlationId,
      );
    }

    if (query.userId) {
      filteredLogs = filteredLogs.filter(
        (log) => log.context.userId === query.userId,
      );
    }

    if (query.startTime) {
      filteredLogs = filteredLogs.filter(
        (log) => log.context.timestamp >= query.startTime!,
      );
    }

    if (query.endTime) {
      filteredLogs = filteredLogs.filter(
        (log) => log.context.timestamp <= query.endTime!,
      );
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredLogs = filteredLogs.filter(
        (log) =>
          log.message.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.context.metadata)
            .toLowerCase()
            .includes(searchLower),
      );
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort(
      (a, b) =>
        b.context.timestamp.getTime() - a.context.timestamp.getTime(),
    );

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
  async getLogsByCorrelationId(correlationId: string): Promise<StructuredLog[]> {
    return this.logs.filter(
      (log) => log.context.correlationId === correlationId,
    );
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
  async getLogStatistics(timeRange?: { start: Date; end: Date }) {
    let logsToAnalyze = this.logs;

    if (timeRange) {
      logsToAnalyze = this.logs.filter(
        (log) =>
          log.context.timestamp >= timeRange.start &&
          log.context.timestamp <= timeRange.end,
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
    this.logs = this.logs.filter(
      (log) => log.context.timestamp > olderThan,
    );
    const removed = initialCount - this.logs.length;
    this.logger.log(`Cleared ${removed} old logs`);
    return removed;
  }

  /**
   * Export logs for analysis
   */
  async exportLogs(query: LogQuery): Promise<string> {
    const result = await this.searchLogs(query);
    return JSON.stringify(result.logs, null, 2);
  }

  /**
   * Send logs to external service (placeholder)
   */
  private async sendToExternalService(log: StructuredLog): Promise<void> {
    // In production, implement integration with:
    // - Elasticsearch
    // - AWS CloudWatch
    // - Datadog
    // - Splunk
    // - Grafana Loki
    // etc.

    // Example: Elasticsearch
    // await this.elasticsearchClient.index({
    //   index: 'logs',
    //   body: log,
    // });

    // For now, just log to console in development
    if (process.env.NODE_ENV === 'development') {
      // Already logged by StructuredLoggerService
    }
  }

  /**
   * Get recent logs
   */
  async getRecentLogs(limit: number = 100): Promise<StructuredLog[]> {
    return this.logs.slice(-limit).reverse();
  }

  /**
   * Count logs by criteria
   */
  async countLogs(query: Partial<LogQuery>): Promise<number> {
    const result = await this.searchLogs(query as LogQuery);
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
