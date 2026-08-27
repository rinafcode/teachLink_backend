import { Logger } from '@nestjs/common';
import { type Request, type Response, type NextFunction } from 'express';
import { getCorrelationId } from '../common/utils/correlation.utils';

const logger = new Logger('RequestIdMiddleware');

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers['x-request-id'] as string | undefined;
  const requestId = getCorrelationId() || header || `${Date.now().toString(36)}-${makeId()}`;
  (req as Request & { requestId?: string }).requestId = requestId;

  const started = Date.now();
  const remoteAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const correlationId = getCorrelationId() || requestId;

  logger.log(
    JSON.stringify({
      event: 'request_start',
      method: req.method,
      url: req.originalUrl || req.url,
      requestId,
      correlationId,
      remoteAddr,
    }),
  );

  res.on('finish', () => {
    const duration = Date.now() - started;
    logger.log(
      JSON.stringify({
        event: 'request_end',
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: duration,
        requestId,
        correlationId,
      }),
    );
  });

  next();
}
