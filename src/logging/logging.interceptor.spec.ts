import { ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';
import { AppLoggerService } from './app-logger.service';
import * as correlationUtils from '../common/utils/correlation.utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockHttpContext(
  method = 'GET',
  url = '/test',
  statusCode = 200,
): ExecutionContext {
  const request = { method, url, headers: { 'user-agent': 'jest' } };
  const response = {
    statusCode,
    setHeader: jest.fn(),
  };
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function mockCallHandler(value?: unknown, error?: Error) {
  return {
    handle: () => (error ? throwError(() => error) : of(value ?? {})),
  };
}

function buildLoggerMock(): jest.Mocked<AppLoggerService> {
  return {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    log: jest.fn(),
    logRequest: jest.fn(),
    logEvent: jest.fn(),
    logQuery: jest.fn(),
    _emit: jest.fn(),
  } as unknown as jest.Mocked<AppLoggerService>;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logger: jest.Mocked<AppLoggerService>;

  beforeEach(() => {
    logger = buildLoggerMock();
    interceptor = new LoggingInterceptor(logger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  // ── happy path ─────────────────────────────────────────────────────────────

  it('should call logRequest on a successful request', (done) => {
    const ctx = mockHttpContext('POST', '/courses', 201);
    const handler = mockCallHandler({ id: '1' });

    interceptor.intercept(ctx, handler).subscribe({
      next: () => {
        /* consume value */
      },
      complete: () => {
        expect(logger.logRequest).toHaveBeenCalledWith(
          'POST',
          '/courses',
          201,
          expect.any(Number),
          expect.any(Object),
        );
        done();
      },
      error: done,
    });
  });

  it('should call debug() at the start of the request', (done) => {
    const ctx = mockHttpContext();
    const handler = mockCallHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('GET /test'),
          expect.any(Object),
        );
        done();
      },
    });
  });

  // ── correlation ID ─────────────────────────────────────────────────────────

  it('should set correlation ID response header when one is available', (done) => {
    jest.spyOn(correlationUtils, 'getCorrelationId').mockReturnValue('corr-123');

    const ctx = mockHttpContext();
    const response = ctx.switchToHttp().getResponse();
    const handler = mockCallHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(response.setHeader).toHaveBeenCalledWith(
          correlationUtils.CORRELATION_ID_HEADER,
          'corr-123',
        );
        done();
      },
    });
  });

  it('should not set correlation ID header when none exists', (done) => {
    jest.spyOn(correlationUtils, 'getCorrelationId').mockReturnValue(undefined);

    const ctx = mockHttpContext();
    const response = ctx.switchToHttp().getResponse();
    const handler = mockCallHandler();

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(response.setHeader).not.toHaveBeenCalled();
        done();
      },
    });
  });

  // ── error path ─────────────────────────────────────────────────────────────

  it('should call logger.error() and re-throw when handler throws', (done) => {
    const ctx = mockHttpContext();
    const err = new Error('DB connection failed');
    const handler = mockCallHandler(undefined, err);

    interceptor.intercept(ctx, handler).subscribe({
      error: (thrown: unknown) => {
        expect(thrown).toBe(err);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('GET /test'),
          err,
          expect.any(Object),
        );
        done();
      },
    });
  });

  it('should infer statusCode 500 when error has no status', (done) => {
    const ctx = mockHttpContext();
    const err = new Error('Unknown');
    const handler = mockCallHandler(undefined, err);

    interceptor.intercept(ctx, handler).subscribe({
      error: () => {
        const callArgs = (logger.error as jest.Mock).mock.calls[0] as unknown[];
        const metadata = callArgs[2] as Record<string, unknown>;
        expect(metadata['statusCode']).toBe(500);
        done();
      },
    });
  });

  it('should infer statusCode from error.status if available', (done) => {
    const ctx = mockHttpContext();
    const err = Object.assign(new Error('Not found'), { status: 404 });
    const handler = mockCallHandler(undefined, err);

    interceptor.intercept(ctx, handler).subscribe({
      error: () => {
        const callArgs = (logger.error as jest.Mock).mock.calls[0] as unknown[];
        const metadata = callArgs[2] as Record<string, unknown>;
        expect(metadata['statusCode']).toBe(404);
        done();
      },
    });
  });

  // ── non-HTTP contexts ──────────────────────────────────────────────────────

  it('should pass through non-HTTP contexts without logging', (done) => {
    const ctx = {
      getType: () => 'ws',
      switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
    } as unknown as ExecutionContext;
    const handler = mockCallHandler('ws-data');

    interceptor.intercept(ctx, handler).subscribe({
      next: (val) => {
        expect(val).toBe('ws-data');
        expect(logger.debug).not.toHaveBeenCalled();
        expect(logger.logRequest).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
