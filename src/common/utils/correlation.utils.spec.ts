import {
  correlationMiddleware,
  getCorrelationId,
  injectCorrelationIdToHeaders,
  CORRELATION_ID_HEADER,
} from './correlation.utils';

describe('correlation.utils', () => {
  it('generates and propagates correlation ID through middleware', (done) => {
    const req: any = { method: 'GET', url: '/test', headers: {} };
    const headers: Record<string, string> = {};
    const res: any = {
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
      getHeader: (name: string) => headers[name.toLowerCase()],
    };

    correlationMiddleware(req, res, () => {
      const id = getCorrelationId();
      expect(typeof id).toBe('string');
      expect(res.getHeader(CORRELATION_ID_HEADER)).toBe(id);
      done();
    });
  });

  it('respects incoming x-request-id header', (done) => {
    const incomingId = 'test-correlation-id';
    const req: any = { method: 'GET', url: '/test', headers: { 'x-request-id': incomingId } };
    const headers: Record<string, string> = {};
    const res: any = {
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
      getHeader: (name: string) => headers[name.toLowerCase()],
    };

    correlationMiddleware(req, res, () => {
      expect(getCorrelationId()).toBe(incomingId);
      expect(res.getHeader(CORRELATION_ID_HEADER)).toBe(incomingId);
      done();
    });
  });

  it('injects correlation header into outgoing request headers', () => {
    const custom = injectCorrelationIdToHeaders({ Authorization: 'Bearer token' }, 'cid-1');
    expect(custom[CORRELATION_ID_HEADER]).toBe('cid-1');
    expect(custom.Authorization).toBe('Bearer token');
  });
});
