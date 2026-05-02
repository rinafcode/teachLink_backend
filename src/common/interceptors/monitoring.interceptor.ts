import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';

/**
 * Intercepts monitoring request handling.
 */
@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsCollectionService) {}

  /**
   * Executes intercept.
   * @param context The context.
   * @param next The next.
   * @returns The resulting observable<any>.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();

    // Some requests might not be HTTP (e.g. WebSocket or Microservice), check if request exists
    if (!request) {
      return next.handle();
    }
}
