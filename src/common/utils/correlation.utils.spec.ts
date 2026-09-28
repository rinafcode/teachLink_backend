import {
  correlationMiddleware,
  CORRELATION_ID_HEADER,
  extractCorrelationIdFromRequest,
  generateCorrelationId,
  getCorrelationId,
  injectCorrelationIdToHeaders,
  runWithCorrelationId,
  X_CORRELATION_ID_HEADER,
} from './correlation.utils';
import { Request, Response } from 'express';

function buildResponse(): {
  res: Response;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: jest.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
    getHeader: (name: string) => headers[name.toLowerCase()],
  } as unknown as Response;

  return { res, headers };
}

describe('correlation.utils', () => {
  it('generates and propagates correlation ID through middleware', (done) => {
    const req = { method: 'GET', url: '/test', headers: {} } as Request;
    const { res } = buildResponse();

    correlationMiddleware(req, res, () => {
      const id = getCorrelationId();
      expect(typeof id).toBe('string');
      expect(res.getHeader(X_CORRELATION_ID_HEADER)).toBe(id);
      expect(res.getHeader(CORRELATION_ID_HEADER)).toBe(id);
      done();
    });
  });

  it('respects incoming x-correlation-id header', (done) => {
    const incomingId = 'client-correlation-id';
    const req = {
      method: 'GET',
      url: '/test',
      headers: { [X_CORRELATION_ID_HEADER]: incomingId },
    } as unknown as Request;
    const { res } = buildResponse();

    correlationMiddleware(req, res, () => {
      expect(getCorrelationId()).toBe(incomingId);
      expect(res.getHeader(X_CORRELATION_ID_HEADER)).toBe(incomingId);
      done();
    });
  });

  it('respects incoming legacy x-request-id header', (done) => {
    const incomingId = 'legacy-request-id';
    const req = {
      method: 'GET',
      url: '/test',
      headers: { [CORRELATION_ID_HEADER]: incomingId },
    } as unknown as Request;
    const { res } = buildResponse();

    correlationMiddleware(req, res, () => {
      expect(getCorrelationId()).toBe(incomingId);
      expect(res.getHeader(CORRELATION_ID_HEADER)).toBe(incomingId);
      done();
    });
  });

  it('prefers x-correlation-id over x-request-id when both are present', () => {
    const req = {
      headers: {
        [X_CORRELATION_ID_HEADER]: 'canonical-id',
        [CORRELATION_ID_HEADER]: 'legacy-id',
      },
    } as unknown as Request;

    expect(extractCorrelationIdFromRequest(req)).toBe('canonical-id');
  });

  it('injects correlation headers into outbound request headers', () => {
    const custom = injectCorrelationIdToHeaders({ Authorization: 'Bearer token' }, 'cid-1');
    expect(custom[X_CORRELATION_ID_HEADER]).toBe('cid-1');
    expect(custom[CORRELATION_ID_HEADER]).toBe('cid-1');
    expect(custom.Authorization).toBe('Bearer token');
  });

  it('uses AsyncLocalStorage context for injectCorrelationIdToHeaders', () => {
    let injected: Record<string, unknown> = {};
    runWithCorrelationId(() => {
      injected = injectCorrelationIdToHeaders();
    }, 'als-id');

    expect(injected[X_CORRELATION_ID_HEADER]).toBe('als-id');
    expect(injected[CORRELATION_ID_HEADER]).toBe('als-id');
  });

  it('does not leak correlation ID outside request scope', async () => {
    const req = { method: 'GET', url: '/test', headers: {} } as Request;
    const { res } = buildResponse();

    await new Promise<void>((resolve) => {
      correlationMiddleware(req, res, () => resolve());
    });

    expect(getCorrelationId()).toBeUndefined();
  });

  it('generates correlation IDs with the expected prefix', () => {
    expect(generateCorrelationId()).toMatch(/^cid-/);
  });

  it('processes 10k middleware invocations within performance budget', () => {
    const iterations = 10_000;
    const start = performance.now();

    for (let index = 0; index < iterations; index += 1) {
      const req = { method: 'GET', url: '/perf', headers: {} } as Request;
      const { res } = buildResponse();
      correlationMiddleware(req, res, () => undefined);
    }

    const elapsedMs = performance.now() - start;
    expect(elapsedMs).toBeLessThan(2000);
  });
});
