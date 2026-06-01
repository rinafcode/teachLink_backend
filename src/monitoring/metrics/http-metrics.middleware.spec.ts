import { HttpMetricsMiddleware } from './http-metrics.middleware';
import { MetricsCollectionService } from './metrics-collection.service';
import { Request, Response } from 'express';

/** Minimal mock for MetricsCollectionService */
const mockMetricsCollectionService = {
  recordHttpRequest: jest.fn(),
  recordApiError: jest.fn(),
};

/** Creates a fake Express Request */
function buildRequest(
  overrides: Partial<Request & { route?: { path?: string } }> = {},
): Request & { route?: { path?: string } } {
  return {
    method: 'GET',
    path: '/courses/123',
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request & { route?: { path?: string } };
}

/** Creates a fake Express Response that fires the 'finish' event synchronously */
function buildResponse(statusCode = 200): {
  res: Response;
  finish: () => void;
} {
  const listeners: Record<string, (() => void)[]> = {};

  const res = {
    statusCode,
    on: jest.fn((event: string, cb: () => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(cb);
    }),
  } as unknown as Response;

  return {
    res,
    finish: () => listeners['finish']?.forEach((fn) => fn()),
  };
}

describe('HttpMetricsMiddleware', () => {
  let middleware: HttpMetricsMiddleware;

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = new HttpMetricsMiddleware(
      mockMetricsCollectionService as unknown as MetricsCollectionService,
    );
  });

  // ── Basic recording ───────────────────────────────────────────────────────

  it('calls recordHttpRequest after response finishes', () => {
    const req = buildRequest({ method: 'GET', path: '/courses' });
    const { res, finish } = buildResponse(200);
    const next = jest.fn();

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();

    finish();

    expect(mockMetricsCollectionService.recordHttpRequest).toHaveBeenCalledTimes(1);
    const [method, route, status, duration] =
      mockMetricsCollectionService.recordHttpRequest.mock.calls[0];

    expect(method).toBe('GET');
    expect(status).toBe(200);
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(route).toBeDefined();
  });

  it('does not record until response finishes', () => {
    const req = buildRequest();
    const { res } = buildResponse(200);
    const next = jest.fn();

    middleware.use(req, res, next);

    // finish() NOT called yet
    expect(mockMetricsCollectionService.recordHttpRequest).not.toHaveBeenCalled();
  });

  // ── Error recording ───────────────────────────────────────────────────────

  it('records API error when status code is 5xx', () => {
    const req = buildRequest({ path: '/payments' });
    const { res, finish } = buildResponse(500);
    const next = jest.fn();

    middleware.use(req, res, next);
    finish();

    expect(mockMetricsCollectionService.recordApiError).toHaveBeenCalledWith(
      expect.any(String),
      '500',
    );
  });

  it('does NOT record API error for 2xx status codes', () => {
    const req = buildRequest({ path: '/users' });
    const { res, finish } = buildResponse(201);
    const next = jest.fn();

    middleware.use(req, res, next);
    finish();

    expect(mockMetricsCollectionService.recordApiError).not.toHaveBeenCalled();
  });

  // ── Route normalisation ───────────────────────────────────────────────────

  it('uses express route template when available', () => {
    const req = buildRequest({
      method: 'GET',
      path: '/courses/999/lessons/42',
      route: { path: '/courses/:courseId/lessons/:lessonId' },
    });
    const { res, finish } = buildResponse(200);

    middleware.use(req, res, jest.fn());
    finish();

    const [, route] = mockMetricsCollectionService.recordHttpRequest.mock.calls[0];
    expect(route).toBe('/courses/:courseId/lessons/:lessonId');
  });

  it('normalises numeric IDs in raw paths when route template is absent', () => {
    const req = buildRequest({ method: 'GET', path: '/courses/123/lessons/456' });
    const { res, finish } = buildResponse(200);

    middleware.use(req, res, jest.fn());
    finish();

    const [, route] = mockMetricsCollectionService.recordHttpRequest.mock.calls[0];
    expect(route).toBe('/courses/:id/lessons/:id');
  });

  it('normalises UUID segments in raw paths', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const req = buildRequest({ method: 'DELETE', path: `/users/${uuid}` });
    const { res, finish } = buildResponse(204);

    middleware.use(req, res, jest.fn());
    finish();

    const [, route] = mockMetricsCollectionService.recordHttpRequest.mock.calls[0];
    expect(route).toBe('/users/:id');
  });

  it('returns /metrics path as-is', () => {
    const req = buildRequest({ method: 'GET', path: '/metrics' });
    const { res, finish } = buildResponse(200);

    middleware.use(req, res, jest.fn());
    finish();

    const [, route] = mockMetricsCollectionService.recordHttpRequest.mock.calls[0];
    expect(route).toBe('/metrics');
  });

  // ── Resilience ────────────────────────────────────────────────────────────

  it('does not throw if recordHttpRequest throws internally', () => {
    mockMetricsCollectionService.recordHttpRequest.mockImplementation(() => {
      throw new Error('prom-client failure');
    });

    const req = buildRequest();
    const { res, finish } = buildResponse(200);

    middleware.use(req, res, jest.fn());

    expect(() => finish()).not.toThrow();
  });
});
