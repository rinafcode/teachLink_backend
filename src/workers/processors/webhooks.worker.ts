import { Injectable, Optional } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { BaseWorker } from '../base/base.worker';
import { WebhookDeliveryService, WebhookTarget } from '../../webhooks/webhook-delivery.service';

/**
 * Webhooks Worker
 *
 * Delivers outbound webhooks via {@link WebhookDeliveryService}, which applies
 * exponential-backoff retries, a configurable max retry count, dead-letter
 * handling and failure monitoring (issue #615).
 *
 * Transient failures raise a retryable error so Bull re-enqueues the job with
 * backoff (the retry queue); permanent failures and exhausted retries resolve
 * with a dead-lettered result.
 */
@Injectable()
export class WebhooksWorker extends BaseWorker {
  private readonly delivery: WebhookDeliveryService;

  // The delivery service is injected under Nest DI, but the worker is also
  // instantiated manually by the orchestration pool (`new WebhooksWorker()`),
  // so fall back to a self-contained default when none is provided.
  constructor(configService: ConfigService, @Optional() delivery?: WebhookDeliveryService) {
    super('webhooks', configService);
    this.delivery = delivery ?? WebhookDeliveryService.createDefault();
  }

  /**
   * Execute a webhook delivery job. `job.attemptsMade` is the number of attempts
   * already completed, which drives backoff scheduling.
   */
  async execute(job: Job): Promise<unknown> {
    const { url, event, payload, headers, secret, timeout } = job.data ?? {};

    await job.progress(20);

    const target: WebhookTarget = {
      url,
      event,
      payload,
      headers,
      secret,
      timeoutMs: timeout,
    };

    await job.progress(40);

    // Delegates retry/backoff/dead-letter decisions to the delivery service.
    // A retryable failure throws here so Bull re-enqueues with backoff.
    const result = await this.delivery.processDelivery(target, job.attemptsMade);

    await job.progress(100);
    return result;
  }
}
