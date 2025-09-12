import { Injectable, Logger } from '@nestjs/common';
import { Repository, Between } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LogEntry } from '../entities/log-entry.entity';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ObservabilityConfig } from '../observability.service';

@Injectable()
export class LogAggregationService {
  private readonly logger = new Logger(LogAggregationService.name);
  private config: ObservabilityConfig;

  constructor(
    @InjectRepository(LogEntry)
    private readonly logEntryRepository: Repository<LogEntry>,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async initialize(config: ObservabilityConfig): Promise<void> {
    this.config = config;
    this.logger.log('Log aggregation initialized');
  }

  async log(
    level: LogEntry['level'],
    message: string,
    context?: Record<string, any>,
    correlationId?: string,
  ): Promise<void> {
    const entry = new LogEntry();
    entry.timestamp = new Date();
    entry.level = level;
    entry.message = message;
    entry.context = context;
    entry.serviceName = this.config.serviceName;
    entry.correlationId = correlationId;

    await this.logEntryRepository.save(entry);
    await this.elasticsearchService.index({
      index: 'log_entries',
      id: entry.id,
      body: {
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
        serviceName: entry.serviceName,
        correlationId: entry.correlationId,
        context: entry.context,
        traceId: entry.traceId,
        spanId: entry.spanId,
        userId: entry.userId,
        sessionId: entry.sessionId,
        requestId: entry.requestId,
        metadata: entry.metadata,
        stackTrace: entry.stackTrace,
        errorCode: entry.errorCode,
        errorType: entry.errorType,
        hostName: entry.hostName,
        processId: entry.processId,
        threadId: entry.threadId,
        createdAt: entry.createdAt,
      },
    });

    this.logger.log(`Log entry saved: ${message}`);
  }

  async getLogCount(from: Date, to: Date): Promise<number> {
    return this.logEntryRepository.count({
      where: { timestamp: Between(from, to) },
    });
  }

  async searchLogs(query: {
    text?: string;
    correlationId?: string;
    startTime?: Date;
    endTime?: Date;
    services?: string[];
  }): Promise<any[]> {
    const mustClauses: any[] = [];

    if (query.text) {
      mustClauses.push({ match: { message: query.text } });
    }

    if (query.correlationId) {
      mustClauses.push({ match: { correlationId: query.correlationId } });
    }

    if (query.startTime && query.endTime) {
      mustClauses.push({
        range: {
          timestamp: {
            gte: query.startTime,
            lte: query.endTime,
          },
        },
      });
    }

    if (query.services && query.services.length > 0) {
      mustClauses.push({ terms: { serviceName: query.services } });
    }

    const searchQuery =
      mustClauses.length > 0
        ? { bool: { must: mustClauses } }
        : { match_all: {} };

    const searchResults = await this.elasticsearchService.search({
      index: 'log_entries',
      query: searchQuery,
    });
    return searchResults.hits.hits;
  }

  async getHealthStatus(): Promise<{ status: string }> {
    return { status: 'healthy' };
  }
}
