import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import {
  extractCorrelationIdFromRequest,
  generateCorrelationId,
  X_CORRELATION_ID_HEADER,
} from '../../common/utils/correlation.utils';

/**
 * Normalises inbound requests before they reach the gateway controller:
 * - Injects a correlation-id header if absent
 * - Strips hop-by-hop headers that must not be forwarded
 * - Adds an X-Gateway-Version header
 */
@Injectable()
export class RequestTransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestTransformInterceptor.name);

  private static readonly HOP_BY_HOP = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
  ]);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();

    if (!extractCorrelationIdFromRequest(req)) {
      req.headers[X_CORRELATION_ID_HEADER] = generateCorrelationId();
    }

    // Remove hop-by-hop headers
    for (const header of Object.keys(req.headers)) {
      if (RequestTransformInterceptor.HOP_BY_HOP.has(header.toLowerCase())) {
        delete req.headers[header];
      }
    }

    // Tag the request as coming through the gateway
    req.headers['x-gateway-version'] = '1';

    this.logger.debug(
      `[${req.headers[X_CORRELATION_ID_HEADER]}] ${req.method} ${req.path}`,
    );

    return next.handle();
  }
}
