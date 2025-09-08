import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { PrioritizationService } from './prioritization/prioritization.service';
import { RetryLogicService } from './retry/retry-logic.service';
import { QueueMonitoringService } from './monitoring/queue-monitoring.service';
import { JobSchedulerService } from './scheduler/job-scheduler.service';
import { QueueStreamingService } from './integration/queue-streaming.service';
import { QueueAnalyticsService } from './analytics/queue-analytics.service';
import { QueueEventPipelineService } from './streaming/queue-event-pipeline.service';
import { QueueDashboardService } from './dashboard/queue-dashboard.service';
import { QueueOptimizationService } from './optimization/queue-optimization.service';
import { QueueAnalyticsController } from './controllers/queue-analytics.controller';
import { StreamingModule } from '../streaming/streaming.module';

/**
 * Module for advanced queue management with job prioritization, retry logic, monitoring,
 * streaming integration, real-time analytics, and performance dashboard
 */
@Module({
  imports: [
    StreamingModule,
  ],
  providers: [
    QueueService,
    PrioritizationService,
    RetryLogicService,
    QueueMonitoringService,
    JobSchedulerService,
    QueueOptimizationService,
    QueueStreamingService,
    QueueAnalyticsService,
    QueueEventPipelineService,
    QueueDashboardService,
  ],
  controllers: [
    QueueAnalyticsController,
  ],
  exports: [
    QueueService,
    PrioritizationService,
    RetryLogicService,
    QueueMonitoringService,
    JobSchedulerService,
    QueueOptimizationService,
    QueueStreamingService,
    QueueAnalyticsService,
    QueueEventPipelineService,
    QueueDashboardService,
  ],
})
export class QueueModule {}