import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { PrioritizationService } from './prioritization/prioritization.service';
import { RetryLogicService } from './retry/retry-logic.service';
import { QueueMonitoringService } from './monitoring/queue-monitoring.service';
import { JobSchedulerService } from './scheduler/job-scheduler.service';
import { DefaultQueueProcessor } from './processors/default-queue.processor';
import { WorkersModule } from '../workers/workers.module';

/**
 * Queue Module
 * Comprehensive queue management with prioritization, retry logic, and monitoring
 * Integrates with Workers Module for async task processing
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_NAMES.DEFAULT,
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
    WorkersModule,
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
