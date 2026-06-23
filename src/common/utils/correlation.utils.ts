import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';

/** Canonical correlation header used across services. */
export const X_CORRELATION_ID_HEADER = 'x-correlation-id';

/** Legacy alias kept for backward compatibility with existing clients. */
export const CORRELATION_ID_HEADER = 'x-request-id';

export interface ICorrelationContext {
  correlationId: string;
}

const correlationStorage = new AsyncLocalStorage<ICorrelationContext>();

/**
 * Generates correlation Id.
 * @returns The resulting string value.
 */
export function generateCorrelationId(): string {
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Retrieves correlation Id.
 * @returns The operation result.
 */
export function getCorrelationId(): string | undefined {
  const store = correlationStorage.getStore();
  return store?.correlationId;
}

/**
 * Extracts an inbound correlation ID from request headers.
 * Accepts both canonical and legacy header names.
 */
export function extractCorrelationIdFromRequest(req: Request): string | undefined {
  const canonical = req.headers[X_CORRELATION_ID_HEADER] as string | undefined;
  const legacy = req.headers[CORRELATION_ID_HEADER] as string | undefined;
  const incoming = (canonical || legacy)?.trim();
  return incoming && incoming.length > 0 ? incoming : undefined;
}

/**
 * Sets correlation Id on the request and response headers.
 * @param req The req.
 * @param res The res.
 * @param correlationId The correlation identifier.
 */
export function setCorrelationId(req: Request, res: Response, correlationId: string): void {
  const extendedReq = req as Request & { correlationId?: string; requestId?: string };
  extendedReq.correlationId = correlationId;
  extendedReq.requestId = correlationId;

  req.headers[X_CORRELATION_ID_HEADER] = correlationId;
  req.headers[CORRELATION_ID_HEADER] = correlationId;

  res.setHeader(X_CORRELATION_ID_HEADER, correlationId);
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
}

/**
 * Executes correlation Middleware.
 * @param req The req.
 * @param res The res.
 * @param next The next.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = extractCorrelationIdFromRequest(req) || generateCorrelationId();
  correlationStorage.run({ correlationId }, () => {
    setCorrelationId(req, res, correlationId);
    next();
  });
}

/**
 * Executes run With Correlation Id.
 * @param callback The callback.
 * @param correlationId The correlation identifier.
 * @returns The resulting t.
 */
export function runWithCorrelationId<T>(callback: () => T, correlationId?: string): T {
  const id = correlationId || generateCorrelationId();
  return correlationStorage.run({ correlationId: id }, callback);
}

/**
 * Injects the active correlation ID into outbound HTTP headers.
 * @param headers The headers.
 * @param correlationId The correlation identifier.
 * @returns The resulting record<string, any>.
 */
export function injectCorrelationIdToHeaders(
  headers: Record<string, unknown> = {},
  correlationId?: string,
): Record<string, unknown> {
  const id = correlationId || getCorrelationId() || generateCorrelationId();
  return {
    ...headers,
    [X_CORRELATION_ID_HEADER]: id,
    [CORRELATION_ID_HEADER]: id,
  };
}
