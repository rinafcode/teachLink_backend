import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = process.hrtime();
    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        const diff = process.hrtime(startTime);
        const durationSeconds = diff[0] + diff[1] / 1e9;

        const route = request.route?.path ?? request.path;

        this.metricsService.apiLatencyHistogram
          .labels(
            request.method,
            route,
            String(response.statusCode),
          )
          .observe(durationSeconds);
      }),
    );
  }
}