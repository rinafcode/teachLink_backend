import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  correlationMiddleware,
  getCorrelationId,
  getRequestStartMs,
} from '../utils/correlation.utils';

/**
 * NestJS class-based wrapper around `correlationMiddleware`.
 *
 * Responsibilities:
 * - Delegates ID extraction / generation / storage to the shared
 *   `correlationMiddleware` function so there is a single source of truth.
 * - Emits structured access logs (request start + completion) with the
 *   correlation ID already stamped, satisfying the "Logging integration"
 *   acceptance criterion.
 * - Records start/end timestamps for lightweight performance verification.
 *
 * Registration: this middleware is applied globally in `CorrelationModule`
 * via `NestModule.configure()`.  The plain-function form is kept in
 * `main.ts` for any bootstrapping that happens before the NestJS DI
 * container is ready.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    // Delegate ID resolution + AsyncLocalStorage wiring to the shared util.
    correlationMiddleware(req, res, () => {
      const correlationId = getCorrelationId();
      const startMs = getRequestStartMs() ?? Date.now();

      this.logger.log(
        JSON.stringify({
          event: 'request_received',
          correlationId,
          method: req.method,
          url: req.originalUrl || req.url,
          remoteAddr: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress,
        }),
      );

      res.on('finish', () => {
        const durationMs = Date.now() - startMs;

        this.logger.log(
          JSON.stringify({
            event: 'request_completed',
            correlationId,
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            durationMs,
          }),
        );
      });

      next();
    });
  }
}
