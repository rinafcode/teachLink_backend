import { Injectable, Logger, LoggerService, Scope } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  ILogContext,
  IStructuredLog,
  LogLevel,
  IErrorDetails,
} from '../interfaces/observability.interfaces';

/**
 * Structured Logger Service
 * Provides structured logging with correlation IDs and context
 */
@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLoggerService implements LoggerService {
  private readonly nestLogger = new Logger(StructuredLoggerService.name);
  private context: Partial<ILogContext> = {};
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
  setContext(context: Partial<ILogContext>): void {
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
  /**
   * Executes log.
   * @param level The level.
   * @param message The message.
   * @param metadata The data to process.
   */
  log(level: LogLevel, message: string, metadata?: Record<string, any>): void;
  /**
   * Executes log.
   * @param messageOrLevel The message or level.
   * @param messageOrMetadata The data to process.
   * @param metadata The data to process.
   */
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
    } else if (typeof messageOrLevel === 'string' && typeof messageOrMetadata === 'object') {
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
  /**
   * Executes error.
   * @param message The message.
   * @param error The error.
   * @param metadata The data to process.
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void;
  /**
   * Executes error.
   * @param message The message.
   * @param traceOrError The trace or error.
   * @param metadata The data to process.
   */
  error(message: string, traceOrError?: string | Error, metadata?: Record<string, any>): void {
    let errorDetails: IErrorDetails | undefined;

    if (traceOrError instanceof Error) {
      errorDetails = {
        name: traceOrError.name,
        message: traceOrError.message,
        stack: traceOrError.stack,
      };
    } else if (typeof traceOrError === 'string') {
      errorDetails = {
        name: 'Error',
        message,
        stack: traceOrError,
      };
    }

    this.writeLog(LogLevel.ERROR, message, metadata, errorDetails);
  }

  /**
   * Log fatal error
   */
  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    const errorDetails: IErrorDetails | undefined = error
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
    error?: IErrorDetails,
  ): void {
    const logContext: ILogContext = {
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

    const structuredLog: IStructuredLog = {
      level,
      message,
      context: logContext,
      error,
    };

    // Output as JSON for log aggregation systems
    const logOutput = JSON.stringify(structuredLog);

    // Route to NestJS Logger based on level — avoids raw console statements
    switch (level) {
      case LogLevel.DEBUG:
        this.nestLogger.debug(logOutput);
        break;
      case LogLevel.INFO:
        this.nestLogger.log(logOutput);
        break;
      case LogLevel.WARN:
        this.nestLogger.warn(logOutput);
        break;
      case LogLevel.ERROR:
        this.nestLogger.error(logOutput);
        break;
      case LogLevel.FATAL:
        this.nestLogger.fatal(logOutput);
        break;
    }
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: Partial<ILogContext>): StructuredLoggerService {
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
  logQuery(query: string, duration: number, metadata?: Record<string, any>): void {
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
  logBusinessEvent(eventName: string, eventData: Record<string, any>): void {
    this.log(LogLevel.INFO, `Business event: ${eventName}`, {
      ...eventData,
      eventName,
      type: 'business_event',
    });
  }
}
