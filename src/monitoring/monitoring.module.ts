import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlertingService } from './alerting/alerting.service';
import { MetricsCollectionService } from './metrics/metrics-collection.service';
import { CustomMetricsService } from './custom-metrics.service';
import { CostTrackingService } from './cost-tracking.service';
import { CostSchedulerService } from './cost-scheduler.service';
import { AwsCostCollectorService } from './cloud/aws-cost-collector.service';
import { PrometheusController } from './metrics/prometheus.controller';
import { DbPoolMetricsCollector } from './metrics/db-pool-metrics.collector';
import { DbMetricsSubscriber } from './metrics/db-metrics.subscriber';

@Module({
  imports: [ConfigModule],
  controllers: [PrometheusController],
  providers: [
    AlertingService,
    MetricsCollectionService,
    CustomMetricsService,
    CostTrackingService,
    CostSchedulerService,
    AwsCostCollectorService,
    DbPoolMetricsCollector,
    DbMetricsSubscriber,
  ],
  exports: [
    AlertingService,
    MetricsCollectionService,
    CustomMetricsService,
    CostTrackingService,
    CostSchedulerService,
    AwsCostCollectorService,
    DbPoolMetricsCollector,
    DbMetricsSubscriber,
  ],
})
export class MonitoringModule {}
