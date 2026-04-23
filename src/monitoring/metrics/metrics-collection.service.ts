import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Histogram, Gauge, Counter } from 'prom-client';

@Injectable()
export class MetricsCollectionService implements OnModuleInit {
  private registry: Registry;
  public httpRequestDuration: Histogram;
  public dbQueryDuration: Histogram;
  public activeConnections: Gauge;
  /** Tracks total DB pool connections acquired since startup (#274) */
  public dbPoolConnectionsAcquired: Counter;
  /** Tracks total DB pool connections released since startup (#274) */
  public dbPoolConnectionsReleased: Counter;
  /** Tracks current DB pool size (active + idle) (#274) */
  public dbPoolSize: Gauge;

  constructor() {
    this.registry = new Registry();

    // HTTP Request Duration
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 1, 1.5, 2, 5],
      registers: [this.registry],
    });

    // Database Query Duration
    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.registry],
    });

    // Active Connections (Example of custom gauge)
    this.activeConnections = new Gauge({
      name: 'active_connections_count',
      help: 'Number of active connections',
      registers: [this.registry],
    });

    // DB connection pool metrics (#274)
    this.dbPoolConnectionsAcquired = new Counter({
      name: 'db_pool_connections_acquired_total',
      help: 'Total number of DB pool connections acquired',
      registers: [this.registry],
    });

    this.dbPoolConnectionsReleased = new Counter({
      name: 'db_pool_connections_released_total',
      help: 'Total number of DB pool connections released',
      registers: [this.registry],
    });

    this.dbPoolSize = new Gauge({
      name: 'db_pool_size',
      help: 'Current DB connection pool size (active + idle)',
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // Collect default system metrics (CPU, Memory, Event Loop, etc.)
    collectDefaultMetrics({ register: this.registry });
  }

  getRegistry(): Registry {
    return this.registry;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  }

  recordDbQuery(queryType: string, table: string, duration: number) {
    this.dbQueryDuration.observe({ query_type: queryType, table }, duration);
  }
}
