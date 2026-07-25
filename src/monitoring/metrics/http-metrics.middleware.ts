import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsCollectionService } from './metrics-collection.service';

/**
 * HTTP Metrics Middleware
 *
 * Automatically records every inbound HTTP request into the Prometheus
 * `http_request_duration_seconds` histogram.
 *
 * Captured labels:
 *   - `method`      – HTTP verb (GET, POST, …)
 *   - `route`       – Normalised route path (falls back to the raw URL when
 *                     no NestJS route metadata is available on the response).
 *   - `status_code` – HTTP response status code
 *
 * The middleware attaches itself to the response `finish` event so the
 * observed duration is the full server-side processing time up to the
 * moment the last byte is flushed to the client.
 *
 * Route normalisation strips dynamic segments to avoid cardinality explosion:
 *   `/courses/123/lessons/456` → `/courses/:id/lessons/:id`
 */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpMetricsMiddleware.name);

  constructor(private readonly metricsCollectionService: MetricsCollectionService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    const method = req.method;

    res.on('finish', () => {
      try {
        const durationNs = process.hrtime.bigint() - start;
        const durationSeconds = Number(durationNs) / 1e9;
        const statusCode = res.statusCode;
        const route = this.normaliseRoute(req);

        this.metricsCollectionService.recordHttpRequest(method, route, statusCode, durationSeconds);

        // Track 5xx errors for the error-rate business metric
        if (statusCode >= 500) {
          this.metricsCollectionService.recordApiError(route, String(statusCode));
        }
      } catch (err) {
        // Never let metric recording crash the application
        this.logger.warn(
          `HTTP metrics recording failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    next();
  }

  /**
   * Produce a low-cardinality route string suitable for use as a Prometheus
   * label value.
   *
   * Priority order:
   * 1. Express `req.route.path` (exact template such as `/users/:id`)
   * 2. Raw `req.path` with numeric/UUID segments replaced by `:id`
   *
   * Additionally the `/metrics` endpoint itself is excluded to avoid
   * recording scrape requests as application traffic.
   */
  private normaliseRoute(req: Request): string {
    // Skip self-scrape traffic
    if (req.path === '/metrics') {
      return '/metrics';
    }

    // Prefer the parameterised express route template when available
    const expressRoute = (req as Request & { route?: { path?: string } }).route?.path;
    if (expressRoute && typeof expressRoute === 'string') {
      return expressRoute;
    }

    // Fallback: normalise raw path by replacing UUIDs and numeric IDs
    return req.path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      .toLowerCase();
  }
}
