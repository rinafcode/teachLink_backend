import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { runWithCorrelationId } from '../common/utils/correlation.utils';

function buildContext(
  overrides: Partial<{
    method: string;
    url: string;
    body: Record<string, unknown>;
    headers: Record<string, unknown>;
  }> = {},
): ExecutionContext {
  const { method = 'GET', url = '/test', body = {}, headers = {} } = overrides;
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        url,
        originalUrl: url,
        body,
        headers,
        socket: { remoteAddress: '127.0.0.1' },
      }),
      getResponse: () => ({
        statusCode: 200,
      }),
    }),
  } as unknown as ExecutionContext;
}

function buildHandler(value: unknown = { data: 'ok' }): CallHandler {
  return { handle: () => of(value) };
}

function buildErrorHandler(err: Error): CallHandler {
  return { handle: () => throwError(() => err) };
}

describe('HttpLoggingInterceptor', () => {
  let interceptor: HttpLoggingInterceptor;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpLoggingInterceptor],
    }).compile();

    interceptor = module.get(HttpLoggingInterceptor);
    logSpy = jest
      .spyOn((interceptor as unknown as { logger: { log: jest.Mock } }).logger, 'log')
      .mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn((interceptor as unknown as { logger: { error: jest.Mock } }).logger, 'error')
      .mockImplementation(() => undefined);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('logs request entry and response', (done) => {
    const ctx = buildContext({ method: 'GET', url: '/api/courses' });
    const handler = buildHandler();

    runWithCorrelationId(() => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          expect(logSpy).toHaveBeenCalledTimes(2);
          const requestLog = JSON.parse(logSpy.mock.calls[0][0]);
          expect(requestLog.event).toBe('http_request');
          expect(requestLog.method).toBe('GET');
          expect(requestLog.url).toBe('/api/courses');
          const responseLog = JSON.parse(logSpy.mock.calls[1][0]);
          expect(responseLog.event).toBe('http_response');
          expect(responseLog.statusCode).toBe(200);
          done();
        },
      });
    }, 'test-cid');
  });

  it('includes correlation ID in log entries', (done) => {
    const ctx = buildContext();
    const handler = buildHandler();

    runWithCorrelationId(() => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          const requestLog = JSON.parse(logSpy.mock.calls[0][0]);
          expect(requestLog.correlationId).toBe('my-cid-123');
          done();
        },
      });
    }, 'my-cid-123');
  });

  it('tracks response time in milliseconds', (done) => {
    const ctx = buildContext();
    const handler = buildHandler();

    runWithCorrelationId(() => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          const responseLog = JSON.parse(logSpy.mock.calls[1][0]);
          expect(typeof responseLog.durationMs).toBe('number');
          expect(responseLog.durationMs).toBeGreaterThanOrEqual(0);
          done();
        },
      });
    }, 'cid-1');
  });

  it('masks sensitive fields in request body', (done) => {
    const ctx = buildContext({
      method: 'POST',
      url: '/auth/login',
      body: { email: 'user@example.com', password: 'secret' },
    });
    const handler = buildHandler();

    runWithCorrelationId(() => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          const requestLog = JSON.parse(logSpy.mock.calls[0][0]);
          expect(requestLog.body.password).toBe('***MASKED***');
          expect(requestLog.body.email).toBe('user@example.com');
          done();
        },
      });
    }, 'cid-2');
  });

  it('masks authorization header', (done) => {
    const ctx = buildContext({
      headers: { authorization: 'Bearer token123', 'content-type': 'application/json' },
    });
    const handler = buildHandler();

    runWithCorrelationId(() => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          const requestLog = JSON.parse(logSpy.mock.calls[0][0]);
          expect(requestLog.headers.authorization).toBe('***MASKED***');
          expect(requestLog.headers['content-type']).toBe('application/json');
          done();
        },
      });
    }, 'cid-3');
  });

  it('logs errors with http_error event', (done) => {
    const ctx = buildContext();
    const err = Object.assign(new Error('Not found'), { status: 404 });
    const handler = buildErrorHandler(err);

    runWithCorrelationId(() => {
      interceptor.intercept(ctx, handler).subscribe({
        error: () => {
          expect(errorSpy).toHaveBeenCalledTimes(1);
          const errorLog = JSON.parse(errorSpy.mock.calls[0][0]);
          expect(errorLog.event).toBe('http_error');
          expect(errorLog.statusCode).toBe(404);
          expect(errorLog.durationMs).toBeGreaterThanOrEqual(0);
          done();
        },
      });
    }, 'cid-4');
  });

  it('skips non-http contexts', () => {
    const wsContext = {
      getType: () => 'ws',
    } as unknown as ExecutionContext;
    const handler = buildHandler();
    const handleSpy = jest.spyOn(handler, 'handle');

    interceptor.intercept(wsContext, handler);

    expect(handleSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
