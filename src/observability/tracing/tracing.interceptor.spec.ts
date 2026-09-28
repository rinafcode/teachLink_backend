import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import { trace } from '@opentelemetry/api';
import { TracingInterceptor } from './tracing.interceptor';
import { StructuredLoggerService } from '../logging/structured-logger.service';

const NONZERO_TRACE_ID = 'abcdef1234567890abcdef1234567890';
const NONZERO_SPAN_ID = '1234567890abcdef';

describe('TracingInterceptor', () => {
  let interceptor: TracingInterceptor;
  let setTraceInfo: jest.Mock;
  let getActiveSpanSpy: jest.SpyInstance;

  beforeEach(async () => {
    setTraceInfo = jest.fn();
    getActiveSpanSpy = jest.spyOn(trace, 'getActiveSpan');

    const moduleRef = await Test.createTestingModule({
      providers: [
        TracingInterceptor,
        {
          provide: StructuredLoggerService,
          useValue: { setTraceInfo } as unknown as StructuredLoggerService,
        },
      ],
    }).compile();

    interceptor = moduleRef.get(TracingInterceptor);
  });

  afterEach(() => {
    getActiveSpanSpy.mockRestore();
  });

  it('does nothing when no active span is present', async () => {
    getActiveSpanSpy.mockReturnValue(undefined);

    await new Promise<void>((resolve) =>
      interceptor.intercept({} as never, { handle: () => of(null) }).subscribe({
        complete: () => resolve(),
      }),
    );

    expect(setTraceInfo).not.toHaveBeenCalled();
  });

  it('attaches trace and span ids to logger when a span is active', async () => {
    getActiveSpanSpy.mockReturnValue({
      spanContext: () => ({ traceId: NONZERO_TRACE_ID, spanId: NONZERO_SPAN_ID }),
    });

    await new Promise<void>((resolve) =>
      interceptor.intercept({} as never, { handle: () => of(null) }).subscribe({
        complete: () => resolve(),
      }),
    );

    expect(setTraceInfo).toHaveBeenCalledTimes(1);
    expect(setTraceInfo).toHaveBeenCalledWith(NONZERO_TRACE_ID, NONZERO_SPAN_ID);
  });

  it('skips logger when active span only emits a noop (all-zero) spanContext', async () => {
    getActiveSpanSpy.mockReturnValue({
      spanContext: () => ({
        traceId: '00000000000000000000000000000000',
        spanId: '0000000000000000',
      }),
    });

    await new Promise<void>((resolve) =>
      interceptor.intercept({} as never, { handle: () => of(null) }).subscribe({
        complete: () => resolve(),
      }),
    );

    expect(setTraceInfo).not.toHaveBeenCalled();
  });

  it('survives a logger setter exception without breaking the request', async () => {
    setTraceInfo.mockImplementation(() => {
      throw new Error('logger unavailable');
    });
    getActiveSpanSpy.mockReturnValue({
      spanContext: () => ({ traceId: NONZERO_TRACE_ID, spanId: NONZERO_SPAN_ID }),
    });

    let ok = false;
    await new Promise<void>((resolve) =>
      interceptor.intercept({} as never, { handle: () => of(null) }).subscribe({
        next: () => (ok = true),
        complete: () => resolve(),
      }),
    );

    expect(ok).toBe(true);
    expect(setTraceInfo).toHaveBeenCalled();
  });
});
