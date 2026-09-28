import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { trace } from '@opentelemetry/api';
import { StructuredLoggerService } from '../logging/structured-logger.service';

/**
 * Bridges active OpenTelemetry spans into the {@link StructuredLoggerService}
 * so every structured log emitted during a request carries `traceId` and
 * `spanId`. This satisfies the "distributed tracing across all service
 * methods" requirement from #828 with a single global registration while
 * auto-instrumentations handle the actual span lifecycle.
 */
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLoggerService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const span = trace.getActiveSpan();
    if (span) {
      const { traceId, spanId } = span.spanContext();
      if (traceId && spanId && traceId !== '00000000000000000000000000000000') {
        try {
          this.logger.setTraceInfo(traceId, spanId);
        } catch {
          // Logger may be transient-scoped; never let a trace hook break the request.
        }
      }
    }
    return next.handle();
  }
}
