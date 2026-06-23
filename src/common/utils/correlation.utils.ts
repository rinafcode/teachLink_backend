import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';

/**
 * Canonical outbound header for the correlation ID.
 * Downstream services should forward this header to propagate the ID.
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Alternate inbound header accepted for backwards compatibility with clients
 * that send `x-request-id` instead of `x-correlation-id`.
 */
export const REQUEST_ID_HEADER_ALIAS = 'x-request-id';

export interface ICorrelationContext {
  correlationId: string;
  /** Epoch milliseconds when the request entered the middleware. */
  requestStartMs: number;
}

const correlationStorage = new AsyncLocalStorage<ICorrelationContext>();

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Generates a lexicographically sortable, human-readable correlation ID.
 * Format: `cid-<base36-timestamp>-<random>` (e.g. `cid-lzxj5b-a3f9k2m1`)
 */
export function generateCorrelationId(): string {
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Returns the correlation ID bound to the current async context, or
 * `undefined` when called outside a correlated scope.
 */
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

/**
 * Returns the epoch-ms timestamp recorded when the correlated request
 * entered the middleware, or `undefined` when outside a correlated scope.
 */
export function getRequestStartMs(): number | undefined {
  return correlationStorage.getStore()?.requestStartMs;
}

/**
 * Attaches the correlation ID to the request object (for downstream
 * NestJS handlers) and echoes it on the response via the canonical header.
 */
export function setCorrelationId(req: Request, res: Response, correlationId: string): void {
  (
    req as Request & {
      correlationId?: string;
    }
  ).correlationId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
}

// ---------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that:
 * 1. Reads an inbound `x-correlation-id` (or `x-request-id` as alias).
 * 2. Generates a fresh ID when none is provided.
 * 3. Runs subsequent handlers inside an `AsyncLocalStorage` context so that
 *    `getCorrelationId()` works anywhere in the call stack without explicit
 *    parameter threading.
 * 4. Sets the canonical `x-correlation-id` response header.
 *
 * This middleware is already wired in `main.ts`. The NestJS class-based
 * version (`CorrelationIdMiddleware`) delegates to this function so there is
 * exactly one implementation.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming =
    (req.headers[CORRELATION_ID_HEADER] as string | undefined) ||
    (req.headers[REQUEST_ID_HEADER_ALIAS] as string | undefined);
  const correlationId = incoming || generateCorrelationId();
  const requestStartMs = Date.now();

  correlationStorage.run({ correlationId, requestStartMs }, () => {
    setCorrelationId(req, res, correlationId);
    next();
  });
}

// ---------------------------------------------------------------------------
// Utilities for outbound calls
// ---------------------------------------------------------------------------

/**
 * Executes `callback` within a new (or supplied) correlated async context.
 * Useful for background jobs and queue workers that run outside an HTTP
 * request lifecycle.
 */
export function runWithCorrelationId<T>(callback: () => T, correlationId?: string): T {
  const id = correlationId || generateCorrelationId();
  return correlationStorage.run({ correlationId: id, requestStartMs: Date.now() }, callback);
}

/**
 * Returns a copy of `headers` with the correlation ID injected under the
 * canonical header name.  Pass this to `axios`, `fetch`, or any HTTP client
 * when making calls to downstream microservices.
 *
 * @example
 * await axios.get(url, { headers: injectCorrelationIdToHeaders() });
 */
export function injectCorrelationIdToHeaders(
  headers: Record<string, any> = {},
  correlationId?: string,
): Record<string, any> {
  const id = correlationId || getCorrelationId() || generateCorrelationId();
  return {
    ...headers,
    [CORRELATION_ID_HEADER]: id,
  };
}
