import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ObservabilityService } from './observability.service';
import { ObservabilityController } from './observability.controller';
import { StructuredLoggerService } from './logging/structured-logger.service';
import { LogAggregationService } from './logging/log-aggregation.service';
import { DistributedTracingService } from './tracing/distributed-tracing.service';
import { MetricsAnalysisService } from './metrics/metrics-analysis.service';
import { AnomalyDetectionService } from './anomaly/anomaly-detection.service';

/**
 * Observability Module
 * Comprehensive logging, tracing, metrics, and anomaly detection
 */
@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ObservabilityController],
  providers: [
    ObservabilityService,
    StructuredLoggerService,
    LogAggregationService,
    DistributedTracingService,
    MetricsAnalysisService,
    AnomalyDetectionService,
  ],
  exports: [
    ObservabilityService,
    StructuredLoggerService,
    LogAggregationService,
    DistributedTracingService,
    MetricsAnalysisService,
    AnomalyDetectionService,
  ],
})
export class ObservabilityModule {}
