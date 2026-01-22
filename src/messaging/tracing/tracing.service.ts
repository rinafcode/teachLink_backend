import { Injectable, Logger } from '@nestjs/common';
import { trace, Span, SpanStatusCode } from '@opentelemetry/api';

@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);
  private readonly tracer = trace.getTracer('teachlink-messaging', '1.0.0');

  startSpan(name: string, parentSpan?: Span): Span {
    const span = this.tracer.startSpan(name, {
      parent: parentSpan,
    });
    this.logger.debug(`Started span: ${name}`);
    return span;
  }

  endSpan(span: Span): void {
    span.end();
    this.logger.debug(`Ended span: ${span.name}`);
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
    return this.tracer.startSpan(name, {
      parent: parentSpan,
    });
  }

  getCurrentSpan(): Span | undefined {
    return trace.getSpan(trace.getActiveContext());
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
