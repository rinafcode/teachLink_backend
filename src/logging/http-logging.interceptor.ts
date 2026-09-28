import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { getCorrelationId } from '../common/utils/correlation.utils';
import { maskSensitiveData, maskHeaders } from './sensitive-data.masker';

const MAX_BODY_LENGTH = 4096;

function truncate(value: unknown): unknown {
  if (typeof value === 'string' && value.length > MAX_BODY_LENGTH) {
    return `${value.slice(0, MAX_BODY_LENGTH)}...[truncated]`;
  }
  return value;
}

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return truncate(body);
  return maskSensitiveData(body);
}

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const correlationId = getCorrelationId() || 'unknown';
    const startTime = Date.now();

    const requestLog: Record<string, unknown> = {
      event: 'http_request',
      correlationId,
      method: req.method,
      url: req.originalUrl || req.url,
      headers: maskHeaders(req.headers as Record<string, unknown>),
      remoteAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
    };

    if (req.body && Object.keys(req.body).length > 0) {
      requestLog.body = sanitizeBody(req.body);
    }

    this.logger.log(JSON.stringify(requestLog));

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startTime;
          this.logger.log(
            JSON.stringify({
              event: 'http_response',
              correlationId,
              method: req.method,
              url: req.originalUrl || req.url,
              statusCode: res.statusCode,
              durationMs,
            }),
          );
        },
        error: (err: unknown) => {
          const durationMs = Date.now() - startTime;
          const statusCode =
            (err as { status?: number; statusCode?: number })?.status ||
            (err as { status?: number; statusCode?: number })?.statusCode ||
            500;
          this.logger.error(
            JSON.stringify({
              event: 'http_error',
              correlationId,
              method: req.method,
              url: req.originalUrl || req.url,
              statusCode,
              durationMs,
              error: err instanceof Error ? { message: err.message, name: err.name } : String(err),
            }),
          );
        },
      }),
    );
  }
}
