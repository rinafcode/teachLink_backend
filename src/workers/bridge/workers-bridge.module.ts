import { Module } from '@nestjs/common';
import { EmailModule } from '../../email-marketing/email.module';
import { WebhooksDeliveryModule } from '../../webhooks/webhooks-delivery.module';
import { MonitoringModule } from '../../monitoring/monitoring.module';
import { QueueModule } from '../../queues/queue.module';
import { DeadLetterModule } from '../../queues/dead-letter/dead-letter.module';
import { MessagingModule } from '../../messaging/messaging.module';
import { EmailWorker } from '../processors/email.worker';
import { MediaProcessingWorker } from '../processors/media-processing.worker';
import { DataSyncWorker } from '../processors/data-sync.worker';
import { BackupProcessingWorker } from '../processors/backup-processing.worker';
import { WebhooksWorker } from '../processors/webhooks.worker';
import { SubscriptionsWorker } from '../processors/subscriptions.worker';
import { WorkersBridgeService } from './workers-bridge.service';

@Module({
  imports: [
    QueueModule,
    DeadLetterModule,
    EmailModule,
    WebhooksDeliveryModule,
    MonitoringModule,
    MessagingModule,
  ],
  providers: [
    EmailWorker,
    MediaProcessingWorker,
    DataSyncWorker,
    BackupProcessingWorker,
    WebhooksWorker,
    SubscriptionsWorker,
    WorkersBridgeService,
  ],
  exports: [WorkersBridgeService],
})
export class WorkersBridgeModule {}
