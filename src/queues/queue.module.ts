import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { PrioritizationService } from './prioritization/prioritization.service';
import { RetryLogicService } from './retry/retry-logic.service';
import { QueueMonitoringService } from './monitoring/queue-monitoring.service';
import { JobSchedulerService } from './scheduler/job-scheduler.service';

/**
 * Module for advanced queue management with job prioritization, retry logic, and monitoring
 */
@Module({
  providers: [
    QueueService,
    PrioritizationService,
    RetryLogicService,
    QueueMonitoringService,
    JobSchedulerService,
  ],
  exports: [
    QueueService,
    PrioritizationService,
    RetryLogicService,
    QueueMonitoringService,
    JobSchedulerService,
  ],
})
export class QueueModule {}