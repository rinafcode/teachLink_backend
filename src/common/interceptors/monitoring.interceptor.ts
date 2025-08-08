import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { MONITOR_OPERATION_KEY, MONITOR_DATABASE_KEY } from '../decorators/monitoring.decorator';
import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';
import { DistributedTracingService } from '../../observability/tracing/distributed-tracing.service';

@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MonitoringInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly metricsService: MetricsCollectionService,
    private readonly tracingService: DistributedTracingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const className = context.getClass().name;
    const methodName = handler.name;

    // Get monitoring metadata
    const monitorOperation = this.reflector.get(MONITOR_OPERATION_KEY, handler);
    const monitorDatabase = this.reflector.get(MONITOR_DATABASE_KEY, handler);

    const operationName = monitorOperation?.operation || `${className}.${methodName}`;
    const tags = monitorOperation?.tags || {};
    const userId = request.user?.id || 'anonymous';
    const startTime = Date.now();

    // Start tracing span if enabled
    let span: any = null;
    if (monitorOperation?.recordTraces) {
      span = this.tracingService.startSpan({
        operationName,
        tags: {
          ...tags,
          userId,
          method: request.method,
          url: request.url,
        },
      });
    }

    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - startTime;
        const statusCode = response?.statusCode || 200;

        // Record metrics if enabled
        if (monitorOperation?.recordMetrics) {
          this.metricsService.recordCustomMetric(`${operationName}_duration`, duration);
          this.metricsService.recordCustomMetric(`${operationName}_success`, 1);
          this.metricsService.recordCustomMetric(`${operationName}_status_${statusCode}`, 1);
        }

        // Record database metrics if enabled
        if (monitorDatabase?.recordQueryTime) {
          this.metricsService.recordCustomMetric(`db_${monitorDatabase.operation}_duration`, duration);
        }

        // Log success if enabled
        if (monitorOperation?.recordLogs) {
          this.logger.log(`Operation ${operationName} completed successfully in ${duration}ms`, {
            userId,
            duration,
            statusCode,
            tags,
          });
        }

        // End tracing span
        if (span) {
          this.tracingService.endSpan(span);
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Record error metrics if enabled
        if (monitorOperation?.recordMetrics) {
          this.metricsService.recordCustomMetric(`${operationName}_duration`, duration);
          this.metricsService.recordCustomMetric(`${operationName}_error`, 1);
          this.metricsService.recordCustomMetric(`${operationName}_status_${statusCode}`, 1);
        }

        // Record database error metrics if enabled
        if (monitorDatabase?.recordQueryTime) {
          this.metricsService.recordCustomMetric(`db_${monitorDatabase.operation}_error`, 1);
        }

        // Log error if enabled
        if (monitorOperation?.recordLogs) {
          this.logger.error(`Operation ${operationName} failed after ${duration}ms`, {
            userId,
            duration,
            statusCode,
            error: error.message,
            tags,
          });
        }

        // End tracing span with error
        if (span) {
          this.tracingService.endSpan(span);
        }

        throw error;
      }),
    );
  }
} 