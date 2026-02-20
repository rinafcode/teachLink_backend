import { Injectable, Logger } from '@nestjs/common';
import { trace, Span, SpanStatusCode, context, Context } from '@opentelemetry/api';
import { TraceSpan, SpanStatus, SpanEvent } from '../interfaces/observability.interfaces';

/**
 * Distributed Tracing Service
 * Provides distributed tracing across all services using OpenTelemetry
 */
@Injectable()
export class DistributedTracingService {
  private readonly logger = new Logger(DistributedTracingService.name);
  private readonly tracer = trace.getTracer('teachlink', '1.0.0');
  private spans: Map<string, TraceSpan> = new Map();

  /**
   * Start a new trace span
   */
  startSpan(name: string, attributes?: Record<string, any>): Span {
    const span = this.tracer.startSpan(name);

    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }

    // Store span info
    const spanContext = span.spanContext();
    const traceSpan: TraceSpan = {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      name,
      startTime: new Date(),
      status: SpanStatus.UNSET,
      attributes: attributes || {},
      events: [],
    };

    this.spans.set(spanContext.spanId, traceSpan);

    this.logger.debug(`Started span: ${name} (${spanContext.spanId})`);
    return span;
  }

  /**
   * End a span
   */
  endSpan(span: Span, status?: SpanStatus): void {
    const spanContext = span.spanContext();
    const traceSpan = this.spans.get(spanContext.spanId);

    if (traceSpan) {
      traceSpan.endTime = new Date();
      traceSpan.duration = traceSpan.endTime.getTime() - traceSpan.startTime.getTime();
      traceSpan.status = status || SpanStatus.OK;
    }

    if (status === SpanStatus.ERROR) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
    this.logger.debug(`Ended span: ${traceSpan?.name} (${spanContext.spanId})`);
  }

  /**
   * Add attributes to a span
   */
  setSpanAttributes(span: Span, attributes: Record<string, any>): void {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });

    const spanContext = span.spanContext();
    const traceSpan = this.spans.get(spanContext.spanId);
    if (traceSpan) {
      traceSpan.attributes = { ...traceSpan.attributes, ...attributes };
    }
  }

  /**
   * Record an exception in a span
   */
  recordException(span: Span, error: Error): void {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });

    const spanContext = span.spanContext();
    const traceSpan = this.spans.get(spanContext.spanId);
    if (traceSpan) {
      traceSpan.status = SpanStatus.ERROR;
      traceSpan.attributes.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.logger.error(`Exception in span: ${error.message}`, error.stack);
  }

  /**
   * Add an event to a span
   */
  addSpanEvent(
    span: Span,
    name: string,
    attributes?: Record<string, any>,
  ): void {
    span.addEvent(name, attributes);

    const spanContext = span.spanContext();
    const traceSpan = this.spans.get(spanContext.spanId);
    if (traceSpan) {
      const event: SpanEvent = {
        name,
        timestamp: new Date(),
        attributes,
      };
      traceSpan.events.push(event);
    }
  }

  /**
   * Execute function within a span
   */
  async executeInSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, any>,
  ): Promise<T> {
    const span = this.startSpan(name, attributes);

    try {
      const result = await fn(span);
      this.endSpan(span, SpanStatus.OK);
      return result;
    } catch (error) {
      this.recordException(span, error as Error);
      this.endSpan(span, SpanStatus.ERROR);
      throw error;
    }
  }

  /**
   * Get current active span
   */
  getCurrentSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * Create a child span from parent
   */
  createChildSpan(parentSpan: Span, name: string, attributes?: Record<string, any>): Span {
    const ctx = trace.setSpan(context.active(), parentSpan);
    
    return context.with(ctx, () => {
      const childSpan = this.startSpan(name, attributes);
      
      const parentContext = parentSpan.spanContext();
      const childContext = childSpan.spanContext();
      const childTraceSpan = this.spans.get(childContext.spanId);
      
      if (childTraceSpan) {
        childTraceSpan.parentSpanId = parentContext.spanId;
      }
      
      return childSpan;
    });
  }

  /**
   * Inject trace context into headers for distributed calls
   */
  injectTraceContext(span: Span): Record<string, string> {
    const spanContext = span.spanContext();
    return {
      'x-trace-id': spanContext.traceId,
      'x-span-id': spanContext.spanId,
      'x-trace-flags': spanContext.traceFlags.toString(),
    };
  }

  /**
   * Extract trace context from headers
   */
  extractTraceContext(headers: Record<string, string>): {
    traceId?: string;
    spanId?: string;
    traceFlags?: number;
  } {
    return {
      traceId: headers['x-trace-id'],
      spanId: headers['x-span-id'],
      traceFlags: headers['x-trace-flags']
        ? parseInt(headers['x-trace-flags'])
        : undefined,
    };
  }

  /**
   * Get trace by ID
   */
  getTraceById(traceId: string): TraceSpan[] {
    return Array.from(this.spans.values()).filter(
      (span) => span.traceId === traceId,
    );
  }

  /**
   * Get span by ID
   */
  getSpanById(spanId: string): TraceSpan | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Get all spans
   */
  getAllSpans(): TraceSpan[] {
    return Array.from(this.spans.values());
  }

  /**
   * Clear old spans
   */
  clearOldSpans(olderThan: Date): number {
    let cleared = 0;
    this.spans.forEach((span, spanId) => {
      if (span.startTime < olderThan) {
        this.spans.delete(spanId);
        cleared++;
      }
    });
    this.logger.log(`Cleared ${cleared} old spans`);
    return cleared;
  }

  /**
   * Get trace statistics
   */
  getTraceStatistics() {
    const spans = Array.from(this.spans.values());
    const completedSpans = spans.filter((s) => s.endTime);

    const durations = completedSpans
      .filter((s) => s.duration)
      .map((s) => s.duration!);

    return {
      total: spans.length,
      completed: completedSpans.length,
      active: spans.length - completedSpans.length,
      avgDuration: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      errorCount: spans.filter((s) => s.status === SpanStatus.ERROR).length,
    };
  }

  /**
   * Trace HTTP request
   */
  async traceHttpRequest<T>(
    method: string,
    url: string,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    return this.executeInSpan(
      `HTTP ${method} ${url}`,
      fn,
      {
        'http.method': method,
        'http.url': url,
        'span.kind': 'client',
      },
    );
  }

  /**
   * Trace database query
   */
  async traceDatabaseQuery<T>(
    query: string,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    return this.executeInSpan(
      'Database Query',
      fn,
      {
        'db.statement': query,
        'db.system': 'postgresql',
        'span.kind': 'client',
      },
    );
  }

  /**
   * Trace external service call
   */
  async traceExternalCall<T>(
    serviceName: string,
    operation: string,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    return this.executeInSpan(
      `${serviceName}.${operation}`,
      fn,
      {
        'service.name': serviceName,
        'operation': operation,
        'span.kind': 'client',
      },
    );
  }
}
