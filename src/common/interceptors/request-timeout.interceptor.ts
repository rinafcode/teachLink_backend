import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import {
  REQUEST_TIMEOUT_METADATA,
  RequestTimeoutConfig,
} from '../decorators/request-timeout.decorator';
import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';
import { getCorrelationId } from '../utils/correlation.utils';

/**
 * Default timeout in milliseconds (30 seconds)
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

@Injectable()
export class RequestTimeoutInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly metricsService: MetricsCollectionService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Get timeout configuration from decorator or use default
    const timeoutConfig = this.reflector.get<RequestTimeoutConfig>(
      REQUEST_TIMEOUT_METADATA,
      context.getHandler(),
    );
    const timeoutMs = timeoutConfig?.timeout ?? DEFAULT_REQUEST_TIMEOUT_MS;

    const request = context.switchToHttp().getRequest();
    const { method, path } = request;
    const route = `${method} ${path}`;

    const startTime = Date.now();

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((error) => {
        const elapsedTime = (Date.now() - startTime) / 1000;

        if (error instanceof TimeoutError) {
          // Record timeout metric
          if (
            this.metricsService &&
            typeof (this.metricsService as any).requestTimeouts !== 'undefined'
          ) {
            (this.metricsService as any).requestTimeouts.inc({ route });
          }
          this.metricsService.httpRequestDuration.observe(
            { method, route, status_code: HttpStatus.GATEWAY_TIMEOUT },
            elapsedTime,
          );

          const timeoutError = new HttpException(
            {
              message: `Request timeout after ${timeoutMs}ms`,
              error: 'Request Timeout',
              statusCode: HttpStatus.GATEWAY_TIMEOUT,
              correlationId: getCorrelationId(),
              timeout: timeoutMs,
            },
            HttpStatus.GATEWAY_TIMEOUT,
          );

          return throwError(() => timeoutError);
        }

        // Re-throw non-timeout errors
        return throwError(() => error);
      }),
    );
  }
}
