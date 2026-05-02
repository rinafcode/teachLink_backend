import { Injectable, Logger } from '@nestjs/common';
import { trace, Span, SpanStatusCode, SpanOptions } from '@opentelemetry/api';

/**
 * Provides tracing operations.
 */
@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);
  private readonly tracer = trace.getTracer('teachlink-messaging', '1.0.0');

  /**
   * Starts span.
   * @param name The name.
   * @param parentSpan The parent span.
   * @returns The resulting span.
   */
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

  /**
   * Executes end Span.
   * @param span The span.
   */
  endSpan(span: Span): void {
    span.end();
    this.logger.debug(`Ended span: ${span.constructor.name || 'Span'}`);
  }

  /**
   * Sets span Attribute.
   * @param span The span.
   * @param key The key.
   * @param value The value.
   */
  setSpanAttribute(span: Span, key: string, value: string | number | boolean): void {
    span.setAttribute(key, value);
  }

  /**
   * Sets span Attributes.
   * @param span The span.
   * @param attributes The attributes.
   */
  setSpanAttributes(span: Span, attributes: Record<string, string | number | boolean>): void {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }

  /**
   * Records exception.
   * @param span The span.
   * @param error The error.
   */
  recordException(span: Span, error: Error): void {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  }

  /**
   * Executes add Event.
   * @param span The span.
   * @param name The name.
   * @param attributes The attributes.
   */
  addEvent(span: Span, name: string, attributes?: Record<string, string | number | boolean>): void {
    span.addEvent(name, attributes);
  }

  /**
   * Creates child Span.
   * @param parentSpan The parent span.
   * @param name The name.
   * @returns The resulting span.
   */
  createChildSpan(parentSpan: Span, name: string): Span {
    // In newer OpenTelemetry versions, parent span handling is different
    return this.tracer.startSpan(name);
  }

  /**
   * Retrieves current Span.
   * @returns The operation result.
   */
  getCurrentSpan(): Span | undefined {
    // getActiveContext doesn't exist in the newer API
    return trace.getActiveSpan();
  }

  /**
   * Executes run In Span.
   * @param name The name.
   * @param fn The fn.
   * @param parentSpan The parent span.
   * @returns The resulting t.
   */
  async runInSpan<T>(name: string, fn: (span: Span) => Promise<T>, parentSpan?: Span): Promise<T> {
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

  /**
   * Executes inject Context.
   * @param span The span.
   * @returns The resulting record<string, string>.
   */
  injectContext(span: Span): Record<string, string> {
    // This would typically inject tracing headers for distributed calls
    // For simplicity, return basic span context
    return {
      'x-trace-id': span.spanContext().traceId,
      'x-span-id': span.spanContext().spanId,
    };
  }

  /**
   * Executes extract Context.
   * @param headers The headers.
   * @returns The operation result.
   */
  extractContext(headers: Record<string, string>): any {
    // Extract tracing context from headers
    // This would be used to continue traces across service boundaries
    return {
      traceId: headers['x-trace-id'],
      spanId: headers['x-span-id'],
    };
  }
}
