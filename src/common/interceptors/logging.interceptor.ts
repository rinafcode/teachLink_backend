import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Request, Response } from 'express';

export interface RequestLog {
  requestId: string;
  timestamp: string;
  method: string;
  url: string;
  route: string;
  ip: string;
  userAgent: string;
  userId?: string | number;
  userRole?: string;
}

export interface ResponseLog extends RequestLog {
  statusCode: number;
  responseTimeMs: number;
  contentLength?: number;
}

/**
 * #154 – LoggingInterceptor
 *
 * Logs every HTTP request with:
 *  - method, URL, resolved route, IP, user-agent
 *  - authenticated user ID + role (when present on request.user)
 *  - response status code and wall-clock response time
 *  - structured JSON output in production, pretty-printed in development
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);
  private readonly isProd = process.env.NODE_ENV === 'production';

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
    const requestId = this.generateRequestId();

    const baseLog: RequestLog = {
      requestId,
      timestamp: new Date().toISOString(),
      method: request.method ?? 'UNKNOWN',
      url: request.url,
      route: request.route?.path ?? request.url,
      ip: this.resolveClientIp(request),
      userAgent: (request.headers['user-agent'] as string) ?? 'unknown',
      ...(request.user?.id !== undefined && { userId: request.user.id as string | number }),
      ...(request.user?.role !== undefined && { userRole: request.user.role as string }),
    };

    this.logIncoming(baseLog);

    return next.handle().pipe(
      tap(() => {
        const response = httpCtx.getResponse<Response>();
        this.logOutgoing({
          ...baseLog,
          statusCode: response.statusCode,
          responseTimeMs: Date.now() - startTime,
          contentLength: this.getContentLength(response),
        });
      }),
      catchError((error: unknown) => {
        const status =
          typeof error === 'object' && error !== null && 'status' in error
            ? (error as { status: number }).status
            : 500;

        this.logOutgoing({
          ...baseLog,
          statusCode: status,
          responseTimeMs: Date.now() - startTime,
        });

        return throwError(() => error);
      }),
    );
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private logIncoming(log: RequestLog): void {
    const message = `→ ${log.method} ${log.url}`;
    this.isProd
      ? this.logger.log(JSON.stringify({ event: 'request.incoming', ...log }))
      : this.logger.log(
          `${message} | id=${log.requestId} ip=${log.ip}${log.userId ? ` user=${log.userId}` : ''}`,
        );
  }

  private logOutgoing(log: ResponseLog): void {
    const message = `← ${log.method} ${log.url} ${log.statusCode} ${log.responseTimeMs}ms`;
    const level = log.statusCode >= 500 ? 'error' : log.statusCode >= 400 ? 'warn' : 'log';

    if (this.isProd) {
      this.logger[level](JSON.stringify({ event: 'request.completed', ...log }));
    } else {
      this.logger[level](
        `${message} | id=${log.requestId}${log.userId ? ` user=${log.userId}` : ''}`,
      );
    }
  }

  private generateRequestId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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