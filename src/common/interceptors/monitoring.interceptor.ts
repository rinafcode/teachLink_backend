import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';

@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsCollectionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    
    // Some requests might not be HTTP (e.g. WebSocket or Microservice), check if request exists
    if (!request) {
        return next.handle();
    }

    const method = request.method || 'UNKNOWN';
    const route = request.route ? request.route.path : request.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const response = httpContext.getResponse();
          const statusCode = response ? response.statusCode : 200;
          const duration = (Date.now() - now) / 1000;
          this.metricsService.recordHttpRequest(method, route, statusCode, duration);
        },
        error: (error) => {
             // Track errors too
             const duration = (Date.now() - now) / 1000;
             const status = error.status || 500;
             this.metricsService.recordHttpRequest(method, route, status, duration);
        }
      }),
    );
  }
}
