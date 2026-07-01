import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import {
  CORRELATION_ID_HEADER,
  generateCorrelationId,
  getCorrelationId,
} from '../common/utils/correlation.utils';

/**
 * LoggingMiddleware
 * ─────────────────
 * A lightweight NestJS middleware that:
 *
 *  1. Reads an existing correlation ID from the incoming request headers
 *     (`x-request-id`) or generates a fresh one if absent.
 *  2. Attaches that ID to the response headers so callers can trace requests.
 *  3. Records a structured log line at the start of every request so that
 *     even requests that never reach a controller (e.g. blocked by a guard)
 *     are still visible in the log stream.
 *
 * The correlation ID is already stored in `AsyncLocalStorage` by
 * `correlationMiddleware` (registered in `main.ts`).  This middleware is
 * intentionally thin — it piggy-backs on that value rather than duplicating
 * the storage logic.
 *
 * Registration
 * ────────────
 * Apply in `LoggingModule.configure()` (already done) or add it manually
 * to any module that needs per-route request logging:
 *
 * ```ts
 * export class YourModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer.apply(LoggingMiddleware).forRoutes('*');
 *   }
 * }
 * ```
 */
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // The correlationMiddleware in main.ts already ran; read the value it set.
    const correlationId =
      getCorrelationId() ??
      (req.headers[CORRELATION_ID_HEADER] as string) ??
      generateCorrelationId();

    // Echo it back so clients don't need a separate request to learn the ID.
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
