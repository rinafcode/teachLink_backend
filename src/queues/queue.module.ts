import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { QueueService } from './queue.service';
import { PrioritizationService } from './prioritization/prioritization.service';
import { RetryStrategyService } from './retry/retry-strategy.service';
import { QueueMetricsService } from './metrics/queue-metrics.service';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Global()
@Module({
  imports: [
    MonitoringModule,
    BullModule.forRoot({
      redis: process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.EMAIL_MARKETING },
      { name: QUEUE_NAMES.SYNC_TASKS },
      { name: QUEUE_NAMES.BACKUP_PROCESSING },
      { name: QUEUE_NAMES.MESSAGE_QUEUE },
      { name: QUEUE_NAMES.MEDIA_PROCESSING },
      { name: QUEUE_NAMES.DEFAULT },
      { name: QUEUE_NAMES.USER_DATA_EXPORT },
      { name: QUEUE_NAMES.SUBSCRIPTIONS },
      { name: QUEUE_NAMES.WEBHOOKS },
      { name: QUEUE_NAMES.DEAD_LETTER },
    ),
  ],
  providers: [QueueService, PrioritizationService, RetryStrategyService, QueueMetricsService],
  exports: [BullModule, QueueService, PrioritizationService, RetryStrategyService],
})
export class QueueModule {}
