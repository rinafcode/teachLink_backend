import { Module } from "@nestjs/common"
import { ScheduleModule } from "@nestjs/schedule"
import { MonitoringService } from "./monitoring.service"
import { PerformanceAnalysisService } from "./performance/performance-analysis.service"
import { OptimizationService } from "./optimization/optimization.service"
import { AlertingService } from "./alerting/alerting.service"
import { MetricsCollectionService } from "./metrics/metrics-collection.service"

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    MonitoringService,
    PerformanceAnalysisService,
    OptimizationService,
    AlertingService,
    MetricsCollectionService,
  ],
  exports: [
    MonitoringService,
    PerformanceAnalysisService,
    OptimizationService,
    AlertingService,
    MetricsCollectionService,
  ],
})
export class MonitoringModule {}
