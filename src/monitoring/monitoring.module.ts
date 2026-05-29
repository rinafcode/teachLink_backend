import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlertingService } from './alerting/alerting.service';
import { MetricsCollectionService } from './metrics/metrics-collection.service';
import { CustomMetricsService } from './custom-metrics.service';

@Module({
  imports: [ConfigModule],
  providers: [AlertingService, MetricsCollectionService, CustomMetricsService],
  exports: [AlertingService, MetricsCollectionService, CustomMetricsService],
})
export class MonitoringModule {}
