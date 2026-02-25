import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  LogContext,
  StructuredLog,
  LogLevel,
  ErrorDetails,
} from '../interfaces/observability.interfaces';

/**
 * Structured Logger Service
 * Provides structured logging with correlation IDs and context
 */
@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLoggerService implements LoggerService {
  private context: Partial<LogContext> = {};
  private serviceName: string = 'teachlink';

  constructor() {
    this.context = {
      service: this.serviceName,
      environment: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * Set context for all subsequent logs
   */
  setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(correlationId: string): void {
    this.context.correlationId = correlationId;
  }

  /**
   * Set trace information
   */
  setTraceInfo(traceId: string, spanId: string): void {
    this.context.traceId = traceId;
    this.context.spanId = spanId;
  }

  /**
   * Set user ID for user-specific logging
   */
  setUserId(userId: string): void {
    this.context.userId = userId;
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log info message
   */
  log(message: string, metadata?: Record<string, any>): void;
  log(level: LogLevel, message: string, metadata?: Record<string, any>): void;
  log(
    messageOrLevel: string | LogLevel,
    messageOrMetadata?: string | Record<string, any>,
    metadata?: Record<string, any>,
  ): void {
    let level: LogLevel;
    let message: string;
    let meta: Record<string, any> | undefined;

    if (typeof messageOrLevel === 'string' && !messageOrMetadata) {
      // log(message)
      level = LogLevel.INFO;
      message = messageOrLevel;
      meta = undefined;
    } else if (
      typeof messageOrLevel === 'string' &&
      typeof messageOrMetadata === 'object'
    ) {
      // log(message, metadata)
      level = LogLevel.INFO;
      message = messageOrLevel;
      meta = messageOrMetadata;
    } else {
      // log(level, message, metadata)
      level = messageOrLevel as LogLevel;
      message = messageOrMetadata as string;
      meta = metadata;
    }

    this.writeLog(level, message, meta);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, trace?: string, metadata?: Record<string, any>): void;
  error(message: string, error?: Error, metadata?: Record<string, any>): void;
  error(
    message: string,
    traceOrError?: string | Error,
    metadata?: Record<string, any>,
  ): void {
    let errorDetails: ErrorDetails | undefined;

    if (traceOrError instanceof Error) {
      errorDetails = {
        name: traceOrError.name,
        message: traceOrError.message,
        stack: traceOrError.stack,
      };
    } else if (typeof traceOrError === 'string') {
      errorDetails = {
        name: 'Error',
        message: message,
        stack: traceOrError,
      };
    }

    this.writeLog(LogLevel.ERROR, message, metadata, errorDetails);
  }

  /**
   * Log fatal error
   */
  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    const errorDetails: ErrorDetails | undefined = error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : undefined;

    this.writeLog(LogLevel.FATAL, message, metadata, errorDetails);
  }

  /**
   * Log with timing information
   */
  logWithTiming(
    level: LogLevel,
    message: string,
    startTime: Date,
    metadata?: Record<string, any>,
  ): void {
    const duration = Date.now() - startTime.getTime();
    this.writeLog(level, message, { ...metadata, duration });
  }

  /**
   * Write structured log
   */
  private writeLog(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: ErrorDetails,
  ): void {
    const logContext: LogContext = {
      correlationId: this.context.correlationId || uuidv4(),
      traceId: this.context.traceId,
      spanId: this.context.spanId,
      userId: this.context.userId,
      requestId: this.context.requestId,
      service: this.context.service || this.serviceName,
      environment: this.context.environment || 'development',
      timestamp: new Date(),
      metadata,
    };

    const structuredLog: StructuredLog = {
      level,
      message,
      context: logContext,
      error,
    };

    // Output as JSON for log aggregation systems
    const logOutput = JSON.stringify(structuredLog);

    // Console output based on level
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logOutput);
        break;
      case LogLevel.INFO:
        console.log(logOutput);
        break;
      case LogLevel.WARN:
        console.warn(logOutput);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(logOutput);
        break;
    }
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: Partial<LogContext>): StructuredLoggerService {
    const childLogger = new StructuredLoggerService();
    childLogger.setContext({ ...this.context, ...additionalContext });
    return childLogger;
  }

  /**
   * Log HTTP request
   */
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>,
  ): void {
    this.log(LogLevel.INFO, `${method} ${url} ${statusCode}`, {
      ...metadata,
      method,
      url,
      statusCode,
      duration,
      type: 'http_request',
    });
  }

  /**
   * Log database query
   */
  logQuery(
    query: string,
    duration: number,
    metadata?: Record<string, any>,
  ): void {
    this.log(LogLevel.DEBUG, 'Database query executed', {
      ...metadata,
      query,
      duration,
      type: 'database_query',
    });
  }

  /**
   * Log business event
   */
  logBusinessEvent(
    eventName: string,
    eventData: Record<string, any>,
  ): void {
    this.log(LogLevel.INFO, `Business event: ${eventName}`, {
      ...eventData,
      eventName,
      type: 'business_event',
    });
  }
}
