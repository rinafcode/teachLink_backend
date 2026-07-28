import { Span, SpanStatusCode, trace } from '@opentelemetry/api';

/**
 * Decorates a service method so it executes inside a child OpenTelemetry
 * span attached to the currently active span. Errors are recorded on the
 * span and re-thrown, so the caller still observes the failure.
 *
 * Falls back to a no-op implementation when no OTel SDK is registered, so
 * unit tests and offline environments do not crash.
 *
 * Usage:
 *   @Trace('cache.getOrSet')
 *   async getOrSet(...) { ... }
 */
export function Trace(spanName?: string): MethodDecorator {
  return function (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    if (!descriptor || typeof descriptor.value !== 'function') {
      return descriptor;
    }
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown> | unknown;
    const name = spanName ?? String(propertyKey);
    descriptor.value = function (...args: unknown[]) {
      const tracer = trace.getTracer('teachlink-backend');
      return tracer.startActiveSpan(name, async (span: Span) => {
        try {
          const result = await original.apply(this, args);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          throw err;
        } finally {
          span.end();
        }
      });
    };
    return descriptor;
  };
}
