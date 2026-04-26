import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';
import { TIME } from '../../common/constants/time.constants';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { WebhookRetry, WebhookStatus, WebhookProvider } from './entities/webhook-retry.entity';

export interface IWebhookQueuePayload {
  webhookRetryId: string;
  provider: WebhookProvider;
  payload: Buffer | Record<string, unknown>;
  signature?: string;
  externalEventId: string;
  headers?: Record<string, string>;
}

@Injectable()
export class WebhookQueueService {
  private readonly logger = new Logger(WebhookQueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.WEBHOOKS)
    private readonly webhookQueue: Queue,
    @InjectRepository(WebhookRetry)
    private readonly webhookRetryRepository: Repository<WebhookRetry>,
  ) {}

  /**
   * Queue a webhook for processing with retry logic
   */
  async queueWebhook(payload: IWebhookQueuePayload): Promise<string> {
    try {
      // Check if webhook already exists (idempotency)
      const existingWebhook = await this.webhookRetryRepository.findOne({
        where: {
          externalEventId: payload.externalEventId,
          provider: payload.provider,
        },
      });

      let webhookRetry: WebhookRetry;

      if (existingWebhook) {
        // Update existing webhook retry
        existingWebhook.status = WebhookStatus.PENDING;
        existingWebhook.payload = payload.payload as Record<string, unknown>;
        existingWebhook.signature = payload.signature;
        existingWebhook.retryCount = 0;
        existingWebhook.headers = payload.headers;
        webhookRetry = await this.webhookRetryRepository.save(existingWebhook);
        this.logger.log(`Updated webhook retry: ${webhookRetry.id}`);
      } else {
        // Create new webhook retry record
        webhookRetry = this.webhookRetryRepository.create({
          provider: payload.provider,
          externalEventId: payload.externalEventId,
          payload: payload.payload as Record<string, unknown>,
          signature: payload.signature,
          status: WebhookStatus.PENDING,
          retryCount: 0,
          headers: payload.headers,
        });
        webhookRetry = await this.webhookRetryRepository.save(webhookRetry);
        this.logger.log(`Created new webhook retry: ${webhookRetry.id}`);
      }

      // Queue the job for processing
      const job = await this.webhookQueue.add(JOB_NAMES.PROCESS_WEBHOOK, payload, {
        attempts: 1, // Let our processor handle retries
        backoff: {
          type: 'exponential',
          delay: TIME.ONE_SECOND_MS,
        },
        removeOnComplete: false,
        removeOnFail: false,
      });

      this.logger.log(
        `Webhook queued for processing. Retry ID: ${webhookRetry.id}, Job ID: ${job.id}`,
      );

      return webhookRetry.id;
    } catch (error: any) {
      this.logger.error(`Failed to queue webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Requeue a failed webhook from the dead letter queue
   */
  async requeueDeadLetterWebhook(webhookRetryId: string): Promise<void> {
    try {
      const webhookRetry = await this.webhookRetryRepository.findOne({
        where: { id: webhookRetryId },
      });

      if (!webhookRetry) {
        throw new Error(`Webhook retry not found: ${webhookRetryId}`);
      }

      if (webhookRetry.status !== WebhookStatus.DEAD_LETTER) {
        throw new Error(
          `Webhook is not in dead letter status. Current status: ${webhookRetry.status}`,
        );
      }

      // Reset retry count and status
      webhookRetry.status = WebhookStatus.PENDING;
      webhookRetry.retryCount = 0;
      webhookRetry.lastError = null;
      webhookRetry.errorDetails = null;
      webhookRetry.nextRetryTime = null;
      await this.webhookRetryRepository.save(webhookRetry);

      // Re-queue the job
      const payload: IWebhookQueuePayload = {
        webhookRetryId: webhookRetry.id,
        provider: webhookRetry.provider,
        payload: webhookRetry.payload,
        signature: webhookRetry.signature,
        externalEventId: webhookRetry.externalEventId,
        headers: webhookRetry.headers,
      };

      await this.webhookQueue.add('process-webhook', payload, {
        attempts: 1,
        backoff: {
          type: 'exponential',
          delay: TIME.ONE_SECOND_MS,
        },
        removeOnComplete: false,
        removeOnFail: false,
      });

      this.logger.log(`Requeued webhook from dead letter: ${webhookRetryId}`);
    } catch (error: any) {
      this.logger.error(`Failed to requeue webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get webhook retry status
   */
  async getWebhookStatus(webhookRetryId: string): Promise<WebhookRetry | null> {
    return this.webhookRetryRepository.findOne({
      where: { id: webhookRetryId },
    });
  }

  /**
   * Get all dead letter webhooks
   */
  async getDeadLetterWebhooks(limit: number = 100): Promise<WebhookRetry[]> {
    return this.webhookRetryRepository.find({
      where: { status: WebhookStatus.DEAD_LETTER },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get pending webhooks
   */
  async getPendingWebhooks(limit: number = 100): Promise<WebhookRetry[]> {
    return this.webhookRetryRepository.find({
      where: { status: WebhookStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * Get processing webhooks
   */
  async getProcessingWebhooks(): Promise<WebhookRetry[]> {
    return this.webhookRetryRepository.find({
      where: { status: WebhookStatus.PROCESSING },
    });
  }
}
