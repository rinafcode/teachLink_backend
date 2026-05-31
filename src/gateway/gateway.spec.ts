import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';
import { GatewayRoutingService } from './services/gateway-routing.service';
import { GatewayRateLimitGuard } from './guards/gateway-rate-limit.guard';
import { RequestTransformInterceptor } from './interceptors/request-transform.interceptor';
import { ResponseCacheInterceptor } from './interceptors/response-cache.interceptor';
import type { ExecutionContext, CallHandler } from '@nestjs/common';

// ─── GatewayRoutingService ────────────────────────────────────────────────────

describe('GatewayRoutingService', () => {
  let service: GatewayRoutingService;
  let http: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayRoutingService,
        {
          provide: HttpService,
          useValue: { request: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(GatewayRoutingService);
    http = module.get(HttpService);
  });

  it('returns a pre-seeded route', () => {
    const route = service.getRoute('courses');
    expect(route.upstream).toBeDefined();
    expect(route.rateLimitPerMinute).toBeGreaterThan(0);
  });

  it('throws NotFoundException for unknown service', () => {
    expect(() => service.getRoute('unknown-svc')).toThrow(NotFoundException);
  });

  it('registers a new route', () => {
    service.registerRoute({
      service: 'payments',
      upstream: 'http://payments:4000',
      weight: 1,
      cacheTtlSeconds: 0,
      rateLimitPerMinute: 60,
    });
    expect(service.getRoute('payments').upstream).toBe('http://payments:4000');
  });

  it('proxies a request via HttpService', async () => {
    (http.request as jest.Mock).mockReturnValue(
      of({ status: 200, data: { ok: true }, headers: {} }),
    );

    const result = await service.proxy('courses', '/api/courses', 'GET', {});
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ ok: true });
    expect(result.cached).toBe(false);
  });
});

// ─── GatewayRateLimitGuard ────────────────────────────────────────────────────

describe('GatewayRateLimitGuard', () => {
  let guard: GatewayRateLimitGuard;
  let routing: jest.Mocked<GatewayRoutingService>;

  const makeCtx = (service: string, ip = '127.0.0.1'): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ params: { service }, ip }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayRateLimitGuard,
        {
          provide: GatewayRoutingService,
          useValue: {
            getRoute: jest.fn().mockReturnValue({ rateLimitPerMinute: 3 }),
          },
        },
      ],
    }).compile();

    guard = module.get(GatewayRateLimitGuard);
    routing = module.get(GatewayRoutingService);
  });

  it('allows requests within the limit', () => {
    expect(guard.canActivate(makeCtx('courses'))).toBe(true);
    expect(guard.canActivate(makeCtx('courses'))).toBe(true);
    expect(guard.canActivate(makeCtx('courses'))).toBe(true);
  });

  it('throws TooManyRequestsException when limit exceeded', () => {
    guard.canActivate(makeCtx('courses'));
    guard.canActivate(makeCtx('courses'));
    guard.canActivate(makeCtx('courses'));
    expect(() => guard.canActivate(makeCtx('courses'))).toThrow();
  });

  it('allows unknown service (defers to controller)', () => {
    (routing.getRoute as jest.Mock).mockImplementation(() => {
      throw new NotFoundException();
    });
    expect(guard.canActivate(makeCtx('unknown'))).toBe(true);
  });
});

// ─── RequestTransformInterceptor ─────────────────────────────────────────────

describe('RequestTransformInterceptor', () => {
  const interceptor = new RequestTransformInterceptor();

  const makeCtx = (headers: Record<string, string> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers, method: 'GET', path: '/test' }),
      }),
    }) as unknown as ExecutionContext;

  const makeHandler = (): CallHandler => ({ handle: () => of('response') });

  it('injects x-correlation-id when absent', () => {
    const headers: Record<string, string> = {};
    interceptor.intercept(makeCtx(headers), makeHandler());
    expect(headers['x-correlation-id']).toBeDefined();
  });

  it('preserves existing x-correlation-id', () => {
    const headers = { 'x-correlation-id': 'my-id' };
    interceptor.intercept(makeCtx(headers), makeHandler());
    expect(headers['x-correlation-id']).toBe('my-id');
  });

  it('strips hop-by-hop headers', () => {
    const headers: Record<string, string> = { connection: 'keep-alive', 'transfer-encoding': 'chunked' };
    interceptor.intercept(makeCtx(headers), makeHandler());
    expect(headers['connection']).toBeUndefined();
    expect(headers['transfer-encoding']).toBeUndefined();
  });

  it('adds x-gateway-version header', () => {
    const headers: Record<string, string> = {};
    interceptor.intercept(makeCtx(headers), makeHandler());
    expect(headers['x-gateway-version']).toBe('1');
  });
});

// ─── ResponseCacheInterceptor ─────────────────────────────────────────────────

describe('ResponseCacheInterceptor', () => {
  let interceptor: ResponseCacheInterceptor;
  let cache: { get: jest.Mock; set: jest.Mock };
  let routing: jest.Mocked<GatewayRoutingService>;

  const makeCtx = (method: string, service: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method, params: { service }, path: `/api/${service}` }),
      }),
    }) as unknown as ExecutionContext;

  const makeHandler = (value = 'data'): CallHandler => ({ handle: () => of(value) });

  beforeEach(() => {
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    routing = {
      getRoute: jest.fn().mockReturnValue({ cacheTtlSeconds: 60 }),
    } as unknown as jest.Mocked<GatewayRoutingService>;
    interceptor = new ResponseCacheInterceptor(cache as never, routing);
  });

  it('skips caching for non-GET requests', async () => {
    const obs = await interceptor.intercept(makeCtx('POST', 'courses'), makeHandler());
    obs.subscribe();
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('returns cached value on hit', async () => {
    cache.get.mockResolvedValue('cached-data');
    const obs = await interceptor.intercept(makeCtx('GET', 'courses'), makeHandler());
    const result = await new Promise((r) => obs.subscribe(r));
    expect(result).toBe('cached-data');
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('stores response in cache on miss', async () => {
    const obs = await interceptor.intercept(makeCtx('GET', 'courses'), makeHandler('fresh'));
    await new Promise((r) => obs.subscribe(r));
    expect(cache.set).toHaveBeenCalledWith(expect.stringContaining('courses'), 'fresh', 60000);
  });
});
