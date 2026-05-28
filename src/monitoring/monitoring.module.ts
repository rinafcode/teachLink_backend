import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MetricsCollectionService } from './metrics/metrics-collection.service';
import { AlertingService } from './alerting/alerting.service';
import { CapacityPlanningService } from './capacity-planning.service';
import { CapacityPlanningController } from './capacity-planning.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [MetricsCollectionService, AlertingService, CapacityPlanningService],
  controllers: [CapacityPlanningController],
  exports: [MetricsCollectionService, AlertingService, CapacityPlanningService],
})
export class MonitoringModule {}
