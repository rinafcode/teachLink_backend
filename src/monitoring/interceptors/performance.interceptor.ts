import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler, Logger } from "@nestjs/common"
import type { Observable } from "rxjs"
import { tap, catchError } from "rxjs/operators"
import { performance } from "perf_hooks"
import type { MetricsCollectionService } from "../metrics/metrics-collection.service"

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name)

  constructor(private readonly metricsCollection: MetricsCollectionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = performance.now()
    const request = context.switchToHttp().getRequest()
    const className = context.getClass().name
    const methodName = context.getHandler().name
    const endpoint = `${className}.${methodName}`

    // Mark performance start
    performance.mark(`${endpoint}-start`)

    return next.handle().pipe(
      tap(() => {
        const endTime = performance.now()
        const duration = endTime - startTime

        // Mark performance end and measure
        performance.mark(`${endpoint}-end`)
        performance.measure(endpoint, `${endpoint}-start`, `${endpoint}-end`)

        // Record metrics
        this.metricsCollection.recordHttpRequest(duration, false)
        this.metricsCollection.recordCustomMetric(`endpoint:${endpoint}`, duration)

        // Log slow operations
        if (duration > 1000) {
          this.logger.warn(`Slow operation detected: ${endpoint} took ${duration.toFixed(2)}ms`)
        }
      }),
      catchError((error) => {
        const endTime = performance.now()
        const duration = endTime - startTime

        // Record error metrics
        this.metricsCollection.recordHttpRequest(duration, true)

        this.logger.error(`Error in ${endpoint} after ${duration.toFixed(2)}ms`, error)
        throw error
      }),
    )
  }
}
