import { Injectable, Logger } from '@nestjs/common';
import { trace, Span, SpanStatusCode, Context, SpanOptions } from '@opentelemetry/api';

@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);
  private readonly tracer = trace.getTracer('teachlink-messaging', '1.0.0');

  startSpan(name: string, parentSpan?: Span): Span {
    const spanOptions: SpanOptions = {};
    if (parentSpan) {
      // We can't pass parent span directly in newer versions
      // Instead, we'd use context propagation
    }
    const span = this.tracer.startSpan(name, spanOptions);
    this.logger.debug(`Started span: ${name}`);
    return span;
  }

  endSpan(span: Span): void {
    span.end();
    this.logger.debug(`Ended span: ${span.constructor.name || 'Span'}`);
  }

  setSpanAttribute(span: Span, key: string, value: string | number | boolean): void {
    span.setAttribute(key, value);
  }

  setSpanAttributes(span: Span, attributes: Record<string, string | number | boolean>): void {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }

  recordException(span: Span, error: Error): void {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  }

  addEvent(span: Span, name: string, attributes?: Record<string, string | number | boolean>): void {
    span.addEvent(name, attributes);
  }

  createChildSpan(parentSpan: Span, name: string): Span {
    // In newer OpenTelemetry versions, parent span handling is different
    return this.tracer.startSpan(name);
  }

  getCurrentSpan(): Span | undefined {
    // getActiveContext doesn't exist in the newer API
    return trace.getActiveSpan();
  }

  async runInSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    parentSpan?: Span,
  ): Promise<T> {
    const span = this.startSpan(name, parentSpan);
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      this.recordException(span, error as Error);
      throw error;
    } finally {
      this.endSpan(span);
    }
  }

  injectContext(span: Span): Record<string, string> {
    // This would typically inject tracing headers for distributed calls
    // For simplicity, return basic span context
    return {
      'x-trace-id': span.spanContext().traceId,
      'x-span-id': span.spanContext().spanId,
    };
  }

  extractContext(headers: Record<string, string>): any {
    // Extract tracing context from headers
    // This would be used to continue traces across service boundaries
    return {
      traceId: headers['x-trace-id'],
      spanId: headers['x-span-id'],
    };
  }
}
