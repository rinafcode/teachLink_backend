import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WorkerOrchestrationService } from './orchestration/worker-orchestration.service';
import { WorkerHealthCheckService } from './health/worker-health-check.service';
import { WebhooksDeliveryModule } from '../webhooks/webhooks-delivery.module';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';
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
  imports: [WebhooksDeliveryModule, EventEmitterModule.forRoot()],
  providers: [
    WorkerOrchestrationService,
    WorkerHealthCheckService,
    MetricsCollectionService,
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
