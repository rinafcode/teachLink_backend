import { Module } from '@nestjs/common';
import { DataPipelineService } from './pipelines/data-pipeline.service';
import { EventSourcingService } from './event-sourcing/event-sourcing.service';
import { CQRSService } from './cqrs/cqrs.service';
import { RealTimeAnalyticsService } from './analytics/real-time-analytics.service';
import { StreamOptimizationService } from './optimization/stream-optimization.service';

@Module({
  providers: [
    DataPipelineService,
    EventSourcingService,
    CQRSService,
    RealTimeAnalyticsService,
    StreamOptimizationService,
  ],
  exports: [
    DataPipelineService,
    EventSourcingService,
    CQRSService,
    RealTimeAnalyticsService,
    StreamOptimizationService,
  ],
})
export class StreamingModule {}