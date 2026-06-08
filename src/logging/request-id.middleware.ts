import { type Request, type Response, type NextFunction } from 'express';

function makeId(): string {
  // simple fast random id
  return Math.random().toString(36).slice(2, 10);
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['x-request-id'] as string | undefined;
  const requestId = header || `${Date.now().toString(36)}-${makeId()}`;
  // attach to request for handlers
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const started = Date.now();
  const remoteAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  console.info({
    event: 'request_start',
    method: req.method,
    url: req.originalUrl || req.url,
    requestId,
    remoteAddr,
  });

  res.on('finish', () => {
    const duration = Date.now() - started;
    console.info({
      event: 'request_end',
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: duration,
      requestId,
    });
  });

  next();
}
