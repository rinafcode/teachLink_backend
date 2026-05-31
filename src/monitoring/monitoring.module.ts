import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertingService } from './alerting/alerting.service';
import { MetricsCollectionService } from './metrics/metrics-collection.service';
import { CustomMetricsService } from './custom-metrics.service';
import { PrometheusController } from './metrics/prometheus.controller';
import { HttpMetricsMiddleware } from './metrics/http-metrics.middleware';
import { DbMetricsSubscriber } from './metrics/db-metrics.subscriber';
import { DbPoolMetricsCollector } from './metrics/db-pool-metrics.collector';

/**
 * MonitoringModule
 *
 * Wires together all observability infrastructure:
 *
 *  - PrometheusController    → exposes GET /metrics for Prometheus scraping
 *  - HttpMetricsMiddleware   → auto-records HTTP request durations
 *  - MetricsCollectionService → central prom-client registry + helper methods
 *  - DbMetricsSubscriber     → TypeORM subscriber for per-query timing
 *  - DbPoolMetricsCollector  → scheduled pool-stat poller
 *  - AlertingService         → threshold-based alerting (email / Slack)
 *  - CustomMetricsService    → in-memory custom business metric aggregation
 */
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule,
  ],
  controllers: [PrometheusController],
  providers: [
    AlertingService,
    MetricsCollectionService,
    CustomMetricsService,
    DbMetricsSubscriber,
    DbPoolMetricsCollector,
  ],
  exports: [
    AlertingService,
    MetricsCollectionService,
    CustomMetricsService,
    DbMetricsSubscriber,
    DbPoolMetricsCollector,
  ],
})
export class MonitoringModule implements NestModule {
  /**
   * Applies the HTTP metrics middleware to all routes except the scrape
   * endpoint itself – avoiding circular observation of /metrics requests.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(HttpMetricsMiddleware)
      .exclude({ path: 'metrics', method: RequestMethod.GET })
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
