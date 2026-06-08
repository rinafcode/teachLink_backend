import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { Request } from 'express';
import { FingerprintInterceptor } from './fingerprint.interceptor';
import { FingerprintService } from './fingerprint.service';
import { AnalyticsService } from '../analytics.service';

type FingerprintedRequest = Request & { fingerprintHash?: string };

function makeReq(overrides: Partial<FingerprintedRequest> = {}): FingerprintedRequest {
  return {
    method: 'GET',
    path: '/test',
    ip: '10.0.0.1',
    headers: { 'user-agent': 'Jest', 'accept-language': 'en' },
    ...overrides,
  } as unknown as FingerprintedRequest;
}

function makeContext(req: FingerprintedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function makeHandler(): CallHandler {
  return { handle: () => of('ok') };
}

describe('FingerprintInterceptor', () => {
  let fingerprintService: FingerprintService;
  let analyticsService: jest.Mocked<Pick<AnalyticsService, 'recordEvent'>>;
  let interceptor: FingerprintInterceptor;

  beforeEach(() => {
    fingerprintService = new FingerprintService();
    analyticsService = { recordEvent: jest.fn() };
    interceptor = new FingerprintInterceptor(
      fingerprintService,
      analyticsService as unknown as AnalyticsService,
    );
  });

  it('returns an observable', () => {
    const req = makeReq();
    const result = interceptor.intercept(makeContext(req), makeHandler());
    expect(result).toBeDefined();
    expect(typeof result.subscribe).toBe('function');
  });

  it('attaches fingerprintHash to the request', () => {
    const req = makeReq();
    interceptor.intercept(makeContext(req), makeHandler());
    expect(req.fingerprintHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('records an analytics event for a new fingerprint', () => {
    // Use a unique IP so this fingerprint is guaranteed not in the shared seen map
    const req = makeReq({ ip: `192.0.2.${Math.floor(Math.random() * 254) + 1}` });
    interceptor.intercept(makeContext(req), makeHandler());
    expect(analyticsService.recordEvent).toHaveBeenCalledWith(
      'request',
      'fingerprint',
      expect.any(String),
    );
  });

  it('deduplicates: does not record a second event for the same fingerprint in the same window', () => {
    const req = makeReq({ ip: `198.51.100.${Math.floor(Math.random() * 254) + 1}` });
    const ctx = makeContext(req);
    interceptor.intercept(ctx, makeHandler());
    interceptor.intercept(ctx, makeHandler());
    expect(analyticsService.recordEvent).toHaveBeenCalledTimes(1);
  });

  it('records separate events for different fingerprints', () => {
    interceptor.intercept(makeContext(makeReq({ ip: '203.0.113.1' })), makeHandler());
    interceptor.intercept(makeContext(makeReq({ ip: '203.0.114.1' })), makeHandler());
    expect(analyticsService.recordEvent).toHaveBeenCalledTimes(2);
  });
});
