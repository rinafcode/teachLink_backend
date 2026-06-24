import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  correlationMiddleware,
  getCorrelationId,
} from '../../common/utils/correlation.utils';

/**
 * Propagates correlation IDs for every inbound HTTP request.
 *
 * - Reads `x-correlation-id` or legacy `x-request-id` from inbound headers
 * - Generates a new ID when absent
 * - Stores the ID in AsyncLocalStorage for downstream handlers
 * - Echoes the ID on the response for client-side tracing
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    correlationMiddleware(req, res, () => {
      const correlationId = getCorrelationId();
      if (correlationId) {
        this.logger.debug(`[${correlationId}] ${req.method} ${req.originalUrl || req.url}`);
      }
      next();
    });
  }
}
