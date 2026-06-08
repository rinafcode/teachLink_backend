import { Module } from '@nestjs/common';
import { WorkerOrchestrationService } from './orchestration/worker-orchestration.service';
import { WorkerHealthCheckService } from './health/worker-health-check.service';
import { WebhooksDeliveryModule } from '../webhooks/webhooks-delivery.module';
import {
  EmailWorker,
  MediaProcessingWorker,
  DataSyncWorker,
  BackupProcessingWorker,
  WebhooksWorker,
  SubscriptionsWorker,
} from './processors';

/**
 * Workers Module
 * Provides centralized async task processing with worker orchestration
 */
@Module({
  imports: [WebhooksDeliveryModule],
  providers: [
    WorkerOrchestrationService,
    WorkerHealthCheckService,
    EmailWorker,
    MediaProcessingWorker,
    DataSyncWorker,
    BackupProcessingWorker,
    WebhooksWorker,
    SubscriptionsWorker,
  ],
  exports: [WorkerOrchestrationService, WorkerHealthCheckService],
})
export class WorkersModule {}
