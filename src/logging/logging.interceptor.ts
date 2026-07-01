import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import type { Request, Response } from 'express';

import { AppLoggerService } from './app-logger.service';
import { getCorrelationId, CORRELATION_ID_HEADER } from '../common/utils/correlation.utils';

/**
 * LoggingInterceptor
 * ──────────────────
 * Attaches to every HTTP route and records:
 *  • Incoming method + URL at DEBUG level
 *  • Outgoing status code + duration at INFO level
 *  • Any thrown exception at ERROR level (then re-throws)
 *
 * The correlation ID is read from AsyncLocalStorage (populated by
 * `correlationMiddleware`) and emitted with every log line so that all
 * records for a single request are traceable.
 *
 * Registration
 * ────────────
 * Either register this interceptor globally in `LoggingModule` via
 * `APP_INTERCEPTOR`, or apply it per-controller with `@UseInterceptors`.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only handle HTTP contexts — WebSocket / gRPC contexts are skipped.
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, url } = req;
    const correlationId = getCorrelationId();
    const startTime = Date.now();

    // Ensure the correlation ID is echoed back in the response header so
    // clients can correlate server-side logs with their own traces.
    if (correlationId) {
      res.setHeader(CORRELATION_ID_HEADER, correlationId);
    }

    this.logger.debug(`→ ${method} ${url}`, {
      correlationId,
      userAgent: req.headers['user-agent'],
    });

    return next.handle().pipe(
      tap(() => {
        const statusCode = res.statusCode;
        const durationMs = Date.now() - startTime;
        this.logger.logRequest(method, url, statusCode, durationMs, { correlationId });
      }),
      catchError((error: unknown) => {
        const durationMs = Date.now() - startTime;
        const statusCode =
          (error as { status?: number; statusCode?: number })?.status ??
          (error as { status?: number; statusCode?: number })?.statusCode ??
          500;

        this.logger.error(
          `✗ ${method} ${url} ${statusCode} (${durationMs}ms)`,
          error instanceof Error ? error : undefined,
          { correlationId, statusCode, durationMs },
        );

        return throwError(() => error);
      }),
    );
  }
}
