import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { MetricsCollectionService } from './metrics/metrics-collection.service';
import { PerformanceAnalysisService } from './performance/performance-analysis.service';
import { OptimizationService } from './optimization/optimization.service';
import { AlertingService } from './alerting/alerting.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [MonitoringController],
  providers: [
    MonitoringService,
    MetricsCollectionService,
    PerformanceAnalysisService,
    OptimizationService,
    AlertingService,
  ],
  exports: [MetricsCollectionService, AlertingService],
})
export class MonitoringModule {}
