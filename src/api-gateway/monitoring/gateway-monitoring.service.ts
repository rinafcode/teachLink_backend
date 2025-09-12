import { Injectable, Logger } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';
import { context, trace, Span, SpanStatusCode } from '@opentelemetry/api';

const register = new Registry();

// Prometheus metrics
const requestCounter = new Counter({
  name: 'api_gateway_requests_total',
  help: 'Total number of API gateway requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});
const requestDuration = new Histogram({
  name: 'api_gateway_request_duration_seconds',
  help: 'API gateway request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});
const errorCounter = new Counter({
  name: 'api_gateway_errors_total',
  help: 'Total number of API gateway errors',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

@Injectable()
export class GatewayMonitoringService {
  private readonly logger = new Logger(GatewayMonitoringService.name);
  private spanMap = new WeakMap<any, Span>();

  /**
   * Log incoming requests, collect metrics, and start tracing span.
   */
  logRequest(request: any): void {
    this.logger.log(
      `Incoming request: ${request.method} ${request.originalUrl}`,
    );
    const route = request.route?.path || request.path || 'unknown';
    const method = request.method;
    // Start timer for Prometheus
    request._startTime = process.hrtime();
    // Start OpenTelemetry span
    const tracer = trace.getTracer('api-gateway');
    const span = tracer.startSpan(`HTTP ${method} ${route}`);
    this.spanMap.set(request, span);
    // Optionally add attributes
    span.setAttribute('http.method', method);
    span.setAttribute('http.route', route);
  }

  /**
   * Log outgoing responses, collect metrics, and end tracing span.
   */
  logResponse(request: any, response: any): void {
    const route = request.route?.path || request.path || 'unknown';
    const method = request.method;
    const status = response.status || response.statusCode || 200;
    this.logger.log(`Outgoing response: status=${status}`);
    // Prometheus metrics
    requestCounter.inc({ method, route, status });
    if (request._startTime) {
      const diff = process.hrtime(request._startTime);
      const duration = diff[0] + diff[1] / 1e9;
      requestDuration.observe({ method, route, status }, duration);
    }
    // End OpenTelemetry span
    const span = this.spanMap.get(request);
    if (span) {
      span.setAttribute('http.status_code', status);
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      this.spanMap.delete(request);
    }
  }

  /**
   * Log errors, increment error metrics, and record trace error.
   */
  logError(request: any, error: any): void {
    const route = request.route?.path || request.path || 'unknown';
    const method = request.method;
    const status = error.status || 500;
    this.logger.error(`Error: ${error.message}`);
    errorCounter.inc({ method, route, status });
    // End OpenTelemetry span with error
    const span = this.spanMap.get(request);
    if (span) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      span.end();
      this.spanMap.delete(request);
    }
  }

  /**
   * Expose Prometheus metrics (to be used in a controller or middleware).
   */
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }
}
