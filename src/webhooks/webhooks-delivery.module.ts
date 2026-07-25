import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookMonitorService } from './webhook-monitor.service';
import { loadWebhookRetryConfig, WEBHOOK_RETRY_CONFIG } from './webhook-retry.config';

/**
 * Outbound webhook delivery with exponential-backoff retries, dead-letter
 * handling and failure monitoring (issue #615).
 */
@Module({
  imports: [HttpModule, MonitoringModule],
  providers: [
    WebhookDeliveryService,
    WebhookMonitorService,
    {
      provide: WEBHOOK_RETRY_CONFIG,
      useFactory: () => loadWebhookRetryConfig(),
    },
  ],
  exports: [WebhookDeliveryService, WebhookMonitorService],
})
export class WebhooksDeliveryModule {}
