import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { MetricsCollectionService } from './metrics/metrics-collection.service';
import { CostTrackingService } from './cost-tracking.service';
import { PerformanceAnalysisService } from './performance/performance-analysis.service';
import { OptimizationService } from './optimization/optimization.service';
import { AlertingService } from './alerting/alerting.service';
import { ScheduledTaskMonitoringService } from './scheduled-task-monitoring.service';
import { CostSchedulerService } from './cost-scheduler.service';
import { AwsCostCollectorService } from './cloud/aws-cost-collector.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [MonitoringController],
  providers: [
    MonitoringService,
    MetricsCollectionService,
    PerformanceAnalysisService,
    OptimizationService,
    AlertingService,
    CostTrackingService,
    CostSchedulerService,
    AwsCostCollectorService,
    ScheduledTaskMonitoringService,
  ],
  exports: [
    MetricsCollectionService,
    AlertingService,
    ScheduledTaskMonitoringService,
    CostTrackingService,
    CostSchedulerService,
    AwsCostCollectorService,
  ],
})
export class MonitoringModule {}
