import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { PrioritizationService } from './prioritization/prioritization.service';
import { RetryLogicService } from './retry/retry-logic.service';
import { QueueMonitoringService } from './monitoring/queue-monitoring.service';
import { JobSchedulerService } from './scheduler/job-scheduler.service';
import { DefaultQueueProcessor } from './processors/default-queue.processor';

/**
 * Queue Module
 * Comprehensive queue management with prioritization, retry logic, and monitoring
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'default',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [QueueController],
  providers: [
    QueueService,
    PrioritizationService,
    RetryLogicService,
    QueueMonitoringService,
    JobSchedulerService,
    DefaultQueueProcessor,
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
