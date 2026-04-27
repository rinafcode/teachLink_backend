import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import {
  CORRELATION_ID_HEADER,
  generateCorrelationId,
  getCorrelationId,
} from '../utils/correlation.utils';
import { LogShipperService } from '../services/log-shipper.service';

/** Standard log-level labels used in the JSON envelope. */
export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Standard log envelope emitted for every HTTP request/response.
 *
 * All fields are present in every log entry so consumers can build
 * consistent Elasticsearch mappings and Kibana dashboards without
 * per-environment special-casing.
 */
export interface IRequestLog {
  '@timestamp': string;
  service: string;
  environment: string;
  level: LogLevel;
  event: string;
  correlationId: string;
  method: string;
  url: string;
  route: string;
  ip: string;
  userAgent: string;
  userId?: string | number;
  userRole?: string;
}

export interface IResponseLog extends IRequestLog {
  statusCode: number;
  responseTimeMs: number;
  contentLength?: number;
}

/**
 * #154 / #360 – LoggingInterceptor
 *
 * Logs every HTTP request with a standardized JSON envelope:
 *  - @timestamp, service, environment, level, event
 *  - correlationId (propagated via AsyncLocalStorage / x-request-id header)
 *  - method, URL, resolved route, IP, user-agent
 *  - authenticated user ID + role (when present on request.user)
 *  - response status code and wall-clock response time
 *
 * JSON format is used in all environments for consistent parsing by
 * log shippers and aggregators (#360).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);
  private readonly service = process.env.npm_package_name ?? 'teachlink-api';
  private readonly environment = process.env.NODE_ENV ?? 'development';

  constructor(private readonly logShipper: LogShipperService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only intercept HTTP contexts (skip WebSockets, microservices, etc.)
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<Request & { user?: Record<string, unknown> }>();

    if (!request) {
      return next.handle();
    }

    const startTime = Date.now();
    const correlationId = getCorrelationId() || generateCorrelationId();

    const response = httpCtx.getResponse<Response>();
    response?.setHeader(CORRELATION_ID_HEADER, correlationId);

    const baseLog: IRequestLog = {
      '@timestamp': new Date().toISOString(),
      service: this.service,
      environment: this.environment,
      level: 'info',
      event: 'request.incoming',
      correlationId,
      method: request.method ?? 'UNKNOWN',
      url: request.url,
      route: request.route?.path ?? request.url,
      ip: this.resolveClientIp(request),
      userAgent: (request.headers['user-agent'] as string) ?? 'unknown',
      ...(request.user?.id !== undefined && { userId: request.user.id as string | number }),
      ...(request.user?.role !== undefined && { userRole: request.user.role as string }),
    };

    this.emit('log', baseLog);

    return next.handle().pipe(
      tap(() => {
        const res = httpCtx.getResponse<Response>();
        const outgoing: IResponseLog = {
          ...baseLog,
          event: 'request.completed',
          statusCode: res.statusCode,
          responseTimeMs: Date.now() - startTime,
          contentLength: this.getContentLength(res),
        };
        outgoing.level = this.resolveLevel(res.statusCode);
        this.emit(
          outgoing.level === 'error' ? 'error' : outgoing.level === 'warn' ? 'warn' : 'log',
          outgoing,
        );
      }),
      catchError((error: unknown) => {
        const status =
          typeof error === 'object' && error !== null && 'status' in error
            ? (error as { status: number }).status
            : 500;

        const outgoing: IResponseLog = {
          ...baseLog,
          event: 'request.completed',
          level: this.resolveLevel(status),
          statusCode: status,
          responseTimeMs: Date.now() - startTime,
        };
        this.emit(
          outgoing.level === 'error' ? 'error' : outgoing.level === 'warn' ? 'warn' : 'log',
          outgoing,
        );

        return throwError(() => error);
      }),
    );
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /** Emit a structured JSON log entry and ship it to the external aggregator. */
  private emit(nestLevel: 'log' | 'warn' | 'error', entry: IRequestLog | IResponseLog): void {
    this.logger[nestLevel](JSON.stringify(entry));
    this.logShipper.ship(entry);
  }

  private resolveLevel(statusCode: number): LogLevel {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  private resolveClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
  }

  private getContentLength(response: Response): number | undefined {
    const header = response.getHeader('content-length');
    return header !== undefined ? Number(header) : undefined;
  }
}
