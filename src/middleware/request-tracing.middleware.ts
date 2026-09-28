import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const TRACE_ID_HEADER = 'x-trace-id';

@Injectable()
export class RequestTracingMiddleware implements NestMiddleware {
  /**
   * Propagates or generates a trace ID for every incoming request.
   * Downstream services should forward the x-trace-id header.
   */
  use(req: Request, res: Response, next: NextFunction): void {
    const traceId = (req.headers[TRACE_ID_HEADER] as string) ?? randomUUID();
    req.headers[TRACE_ID_HEADER] = traceId;
    res.setHeader(TRACE_ID_HEADER, traceId);
    next();
  }
}

/** Returns the trace ID from a request, or a fallback UUID. */
export function getTraceId(req: Request): string {
  return (req.headers[TRACE_ID_HEADER] as string) ?? randomUUID();
}
