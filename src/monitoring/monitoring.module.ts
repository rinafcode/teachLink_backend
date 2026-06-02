import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlertingService } from './alerting/alerting.service';
import { MetricsCollectionService } from './metrics/metrics-collection.service';
import { CustomMetricsService } from './custom-metrics.service';
import { PrometheusController } from './metrics/prometheus.controller';
import { CostController } from './cost.controller';
import { HttpMetricsMiddleware } from './metrics/http-metrics.middleware';
import { DbMetricsSubscriber } from './metrics/db-metrics.subscriber';
import { DbPoolMetricsCollector } from './metrics/db-pool-metrics.collector';
import { CommonModule } from '../common/common.module';
import { CostTrackingService } from './cost-tracking.service';
import { CostSchedulerService } from './cost-scheduler.service';
import { AwsCostCollectorService } from './cloud/aws-cost-collector.service';;

@Module({
  imports: [ConfigModule],
  providers: [
    AlertingService,
    MetricsCollectionService,
    CustomMetricsService,
    CostTrackingService,
    CostSchedulerService,
    AwsCostCollectorService,
  ],
  exports: [
    AlertingService,
    MetricsCollectionService,
    CustomMetricsService,
    CostTrackingService,
    CostSchedulerService,
    AwsCostCollectorService,
  ],
})
export class MonitoringModule {}
