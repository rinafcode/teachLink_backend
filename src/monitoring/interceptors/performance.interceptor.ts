import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  Logger,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { performance } from 'perf_hooks';
import type { MetricsCollectionService } from '../metrics/metrics-collection.service';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  constructor(private readonly metricsCollection: MetricsCollectionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = performance.now();
    const request = context.switchToHttp().getRequest();
    const className = context.getClass().name;
    const methodName = context.getHandler().name;
    const endpoint = `${className}.${methodName}`;
    const userId = request.user?.id || request.userId || 'anonymous';
    const method = request.method;
    const url = request.originalUrl || request.url;

    // Mark performance start
    performance.mark(`${endpoint}-start`);

    return next.handle().pipe(
      tap((response) => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        const statusCode =
          response?.statusCode || request.res?.statusCode || 200;

        // Mark performance end and measure
        performance.mark(`${endpoint}-end`);
        performance.measure(endpoint, `${endpoint}-start`, `${endpoint}-end`);

        // Record metrics (could be extended to accept tags)
        this.metricsCollection.recordHttpRequest(duration, false);
        this.metricsCollection.recordCustomMetric(
          `endpoint:${endpoint}`,
          duration,
        );

        // Log with custom tags
        const logTags = {
          userId,
          method,
          url,
          statusCode,
          duration: duration.toFixed(2),
        };
        if (duration > 1000) {
          this.logger.warn(`Slow operation detected: ${endpoint}`, logTags);
        } else {
          this.logger.log(`Request handled: ${endpoint}`, logTags);
        }
      }),
      catchError((error) => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        const statusCode = request.res?.statusCode || 500;

        // Record error metrics
        this.metricsCollection.recordHttpRequest(duration, true);

        // Log error with custom tags
        const logTags = {
          userId,
          method,
          url,
          statusCode,
          duration: duration.toFixed(2),
          error: error?.message || error,
        };
        this.logger.error(`Error in ${endpoint}`, logTags);
        throw error;
      }),
    );
  }
}
