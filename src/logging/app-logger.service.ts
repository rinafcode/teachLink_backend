import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';
import { getCorrelationId } from '../common/utils/correlation.utils';
import { redactSensitiveData } from './redaction.util';

/**
 * Standardised log levels. Maps 1-to-1 onto NestJS/console levels.
 */
export enum AppLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Shape of every structured log record emitted by AppLogger.
 */
export interface IAppLogRecord {
  level: AppLogLevel;
  message: string;
  context: string;
  correlationId: string | undefined;
  timestamp: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * AppLogger — the single, project-wide logger.
 *
 * Key behaviours
 * ──────────────
 * • Emits **structured JSON** on every log call so that log-shipping tools
 *   (Filebeat, Fluent Bit, CloudWatch, etc.) can parse fields without regex.
 * • Automatically attaches the **correlation ID** sourced from
 *   AsyncLocalStorage (set by the correlation middleware / interceptor).
 * • Applies **sensitive-data redaction** to the `metadata` payload before
 *   serialising, so secrets / PII never reach the log sink.
 * • Delegates to NestJS's built-in `ConsoleLogger` so the standard
 *   `LOG_LEVEL` environment variable and NestJS bootstrap options still work.
 *
 * Usage
 * ─────
 * Inject via DI (preferred):
 *
 *   constructor(private readonly logger: AppLoggerService) {}
 *   this.logger.setContext('MyService');
 *   this.logger.info('User enrolled', { userId, courseId });
 *
 * Or create an instance directly (for use outside DI, e.g. main.ts):
 *
 *   const logger = new AppLoggerService('Bootstrap');
 *   logger.info('App starting');
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService extends ConsoleLogger {
  constructor(context?: string) {
    super(context ?? 'App');
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Override context after instantiation (useful when scope is TRANSIENT).
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Log at INFO level — normal operational events.
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this._emit(AppLogLevel.INFO, message, metadata);
  }

  /**
   * Log an outgoing or executed database query at DEBUG level.
   */
  logQuery(query: string, durationMs: number, metadata?: Record<string, unknown>): void {
    this._emit(AppLogLevel.DEBUG, 'DB query', {
      ...metadata,
      type: 'db_query',
      query,
      durationMs,
    });
  }

  /**
   * Log an HTTP request completion event at INFO level.
   */
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    durationMs: number,
    metadata?: Record<string, unknown>,
  ): void {
    this._emit(AppLogLevel.INFO, `${method} ${url} ${statusCode}`, {
      ...metadata,
      type: 'http_request',
      method,
      url,
      statusCode,
      durationMs,
    });
  }

  /**
   * Emit a domain/business event at INFO level.
   */
  logEvent(eventName: string, payload?: Record<string, unknown>): void {
    this._emit(AppLogLevel.INFO, `event:${eventName}`, {
      ...payload,
      type: 'business_event',
      eventName,
    });
  }

  // ─── NestJS ConsoleLogger overrides ───────────────────────────────────────
  //
  // ConsoleLogger signatures (NestJS 10):
  //   debug(message: any, context?: string): void
  //   warn(message: any, context?: string): void
  //   error(message: any, stackOrContext?: string): void
  //   fatal(message: any, context?: string): void
  //   log(message: any, context?: string): void
  //
  // We keep the same arity so TypeScript is happy, but intercept calls that
  // come from application code (where the second param is a metadata object
  // rather than a string context).

  /**
   * Log at DEBUG level — verbose internal details.
   * When called by application code pass metadata as the second argument.
   * When called by NestJS internals the second argument will be a string context.
   */
  override debug(message: unknown, context?: unknown): void {
    if (typeof context === 'object' && context !== null) {
      this._emit(AppLogLevel.DEBUG, String(message), context as Record<string, unknown>);
    } else {
      this._emit(AppLogLevel.DEBUG, String(message));
    }
  }

  /**
   * Log at WARN level — recoverable anomalies.
   */
  override warn(message: unknown, context?: unknown): void {
    if (typeof context === 'object' && context !== null) {
      this._emit(AppLogLevel.WARN, String(message), context as Record<string, unknown>);
    } else {
      this._emit(AppLogLevel.WARN, String(message));
    }
  }

  /**
   * Log at ERROR level — unexpected failures.
   *
   * Application usage:
   *   logger.error('message', new Error('cause'), { extra: 'data' })
   *
   * NestJS internal usage:
   *   logger.error('message', 'stack trace string', 'ContextName')
   */
  override error(message: unknown, stackOrError?: unknown, context?: unknown): void {
    if (stackOrError instanceof Error) {
      const errorInfo: IAppLogRecord['error'] = {
        name: stackOrError.name,
        message: stackOrError.message,
        stack: stackOrError.stack,
      };
      this._emit(
        AppLogLevel.ERROR,
        String(message),
        typeof context === 'object' && context !== null
          ? (context as Record<string, unknown>)
          : undefined,
        errorInfo,
      );
    } else {
      // NestJS or string-trace path
      this._emit(AppLogLevel.ERROR, String(message));
    }
  }

  /**
   * Log at FATAL level — critical failures.
   */
  override fatal(message: unknown, context?: unknown): void {
    if (context instanceof Error) {
      const errorInfo: IAppLogRecord['error'] = {
        name: context.name,
        message: context.message,
        stack: context.stack,
      };
      this._emit(AppLogLevel.FATAL, String(message), undefined, errorInfo);
    } else {
      this._emit(AppLogLevel.FATAL, String(message));
    }
  }

  /**
   * Log at INFO level — NestJS calls log(message, context?) internally.
   */
  override log(message: unknown, context?: unknown): void {
    if (typeof context === 'object' && context !== null) {
      this._emit(AppLogLevel.INFO, String(message), context as Record<string, unknown>);
    } else {
      this._emit(AppLogLevel.INFO, String(message));
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  _emit(
    level: AppLogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: IAppLogRecord['error'],
  ): void {
    const record: IAppLogRecord = {
      level,
      message,
      context: this.context ?? 'App',
      correlationId: getCorrelationId(),
      timestamp: new Date().toISOString(),
      ...(metadata ? { metadata: redactSensitiveData(metadata) } : {}),
      ...(error ? { error } : {}),
    };

    const serialised = JSON.stringify(record);

    switch (level) {
      case AppLogLevel.DEBUG:
        super.debug(serialised, record.context);
        break;
      case AppLogLevel.INFO:
        super.log(serialised, record.context);
        break;
      case AppLogLevel.WARN:
        super.warn(serialised, record.context);
        break;
      case AppLogLevel.ERROR:
        super.error(serialised, undefined, record.context);
        break;
      case AppLogLevel.FATAL:
        super.fatal?.(serialised, record.context);
        break;
    }
  }
}
