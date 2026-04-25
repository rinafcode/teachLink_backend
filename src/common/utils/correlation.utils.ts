import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';
export const CORRELATION_ID_HEADER = 'x-request-id';
export interface CorrelationContext {
    correlationId: string;
}
const correlationStorage = new AsyncLocalStorage<CorrelationContext>();
export function generateCorrelationId(): string {
    return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
export function getCorrelationId(): string | undefined {
    const store = correlationStorage.getStore();
    return store?.correlationId;
}
export function setCorrelationId(req: Request, res: Response, correlationId: string): void {
    (req as Request & {
        correlationId?: string;
    }).correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
}
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
    const incoming = (req.headers[CORRELATION_ID_HEADER] as string) || (req.headers['x-correlation-id'] as string);
    const correlationId = incoming || generateCorrelationId();
    correlationStorage.run({ correlationId }, () => {
        setCorrelationId(req, res, correlationId);
        next();
    });
}
export function runWithCorrelationId<T>(callback: () => T, correlationId?: string): T {
    const id = correlationId || generateCorrelationId();
    return correlationStorage.run({ correlationId: id }, callback);
}
export function injectCorrelationIdToHeaders(headers: Record<string, unknown> = {}, correlationId?: string): Record<string, unknown> {
    const id = correlationId || getCorrelationId() || generateCorrelationId();
    return {
        ...headers,
        [CORRELATION_ID_HEADER]: id,
    };
}
