import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookRetry, WebhookStatus, WebhookProvider } from './entities/webhook-retry.entity';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { PaymentsService } from '../payments.service';
import {
  SubscriptionWebhookEvent,
  RefundWebhookData,
} from '../interfaces/payment-provider.interface';
import { PaymentStatus } from '../entities/payment.entity';

interface StripePaymentIntent {
  id: string;
  metadata: Record<string, unknown>;
}

interface StripeCharge {
  payment_intent: string;
  refunds: {
    data: RefundWebhookData[];
  };
}

interface PayPalResource {
  id: string;
  parent_payment: string;
  amount: number;
}

interface PayPalWebhookPayload {
  event_type: string;
  resource: PayPalResource;
}

interface WebhookJobData {
  webhookRetryId: string;
  provider: WebhookProvider;
  payload: Buffer | Record<string, unknown>;
  signature?: string;
  externalEventId: string;
  headers?: Record<string, string>;
}

@Injectable()
@Processor(QUEUE_NAMES.WEBHOOKS)
export class WebhookRetryProcessor {
  private readonly logger = new Logger(WebhookRetryProcessor.name);

  // Exponential backoff configuration
  private readonly initialDelayMs = 1000; // 1 second
  private readonly maxDelayMs = 3600000; // 1 hour
  private readonly backoffMultiplier = 2;

  constructor(
    @InjectRepository(WebhookRetry)
    private readonly webhookRetryRepository: Repository<WebhookRetry>,
    private readonly providerFactory: ProviderFactoryService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Process(JOB_NAMES.PROCESS_WEBHOOK)
  async processWebhook(job: Job<WebhookJobData>) {
    const { webhookRetryId, provider, payload, signature, externalEventId, headers } =
      job.data;

    try {
      // Update status to processing
      let webhookRetry = await this.webhookRetryRepository.findOne({
        where: { id: webhookRetryId },
      });

      if (!webhookRetry) {
        this.logger.warn(`Webhook retry record not found: ${webhookRetryId}`);
        return;
      }

      webhookRetry.status = WebhookStatus.PROCESSING;
      await this.webhookRetryRepository.save(webhookRetry);

      // Process the webhook based on provider
      if (provider === WebhookProvider.STRIPE) {
        await this.handleStripeWebhook(payload as Buffer, signature, webhookRetryId);
      } else if (provider === WebhookProvider.PAYPAL) {
        await this.handlePayPalWebhook(
          payload as Record<string, unknown>,
          headers,
          webhookRetryId,
        );
      }

      // Mark as succeeded
      webhookRetry = await this.webhookRetryRepository.findOne({
        where: { id: webhookRetryId },
      });
      webhookRetry.status = WebhookStatus.SUCCEEDED;
      webhookRetry.processedAt = new Date();
      await this.webhookRetryRepository.save(webhookRetry);

      this.logger.log(`Webhook processed successfully: ${webhookRetryId}`);
    } catch (error: any) {
      await this.handleWebhookError(webhookRetryId, error, job);
    }
  }

  private async handleWebhookError(
    webhookRetryId: string,
    error: Error,
    job: Job<WebhookJobData>,
  ): Promise<void> {
    const webhookRetry = await this.webhookRetryRepository.findOne({
      where: { id: webhookRetryId },
    });

    if (!webhookRetry) {
      this.logger.error(`Webhook retry record not found for error handling: ${webhookRetryId}`);
      return;
    }

    webhookRetry.retryCount += 1;
    webhookRetry.lastError = error.message;
    webhookRetry.errorDetails = {
      stack: error.stack,
      timestamp: new Date().toISOString(),
      retryCount: webhookRetry.retryCount,
    };

    // Check if we should retry
    if (webhookRetry.retryCount < webhookRetry.maxRetries) {
      // Calculate next retry time with exponential backoff
      const nextRetryTime = this.calculateNextRetryTime(webhookRetry.retryCount);
      webhookRetry.nextRetryTime = new Date(Date.now() + nextRetryTime);
      webhookRetry.status = WebhookStatus.PENDING;

      await this.webhookRetryRepository.save(webhookRetry);
      this.logger.warn(
        `Webhook ${webhookRetryId} will be retried at ${webhookRetry.nextRetryTime}. Retry ${webhookRetry.retryCount}/${webhookRetry.maxRetries}`,
      );

      // Re-queue the job with delay
      await job.retry(new Error(`Retry ${webhookRetry.retryCount}/${webhookRetry.maxRetries}`));
    } else {
      // All retries exhausted - move to dead letter
      webhookRetry.status = WebhookStatus.DEAD_LETTER;
      await this.webhookRetryRepository.save(webhookRetry);

      this.logger.error(
        `Webhook ${webhookRetryId} moved to dead letter after ${webhookRetry.retryCount} attempts. Error: ${error.message}`,
      );

      // You can emit an event here for alerting operations team
      // this.eventEmitter.emit('webhook.dead-letter', { webhookRetryId, error });
    }
  }

  private calculateNextRetryTime(retryCount: number): number {
    // Exponential backoff: initialDelay * (backoffMultiplier ^ retryCount)
    const delay = this.initialDelayMs * Math.pow(this.backoffMultiplier, retryCount);
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    const totalDelay = Math.min(delay + jitter, this.maxDelayMs);
    return totalDelay;
  }

  private async handleStripeWebhook(
    payload: Buffer,
    signature: string,
    webhookRetryId: string,
  ): Promise<void> {
    if (!payload) {
      throw new Error('Missing payload for Stripe webhook');
    }

    let event: any;
    try {
      const stripeProvider = this.providerFactory.getProvider('stripe');
      event = await stripeProvider.handleWebhook(payload, signature);
    } catch (err: any) {
      this.logger.error(`Stripe webhook signature verification failed: ${err.message}`);
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    this.logger.log(`Processing Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as StripePaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as StripePaymentIntent);
        break;
      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object as StripeCharge);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionEvent(event as unknown as SubscriptionWebhookEvent);
        break;
      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: StripePaymentIntent,
  ): Promise<void> {
    await this.paymentsService.updatePaymentStatus(
      paymentIntent.id,
      PaymentStatus.COMPLETED,
      paymentIntent.metadata,
    );
  }

  private async handlePaymentIntentFailed(paymentIntent: StripePaymentIntent): Promise<void> {
    await this.paymentsService.updatePaymentStatus(
      paymentIntent.id,
      PaymentStatus.FAILED,
      paymentIntent.metadata,
    );
  }

  private async handleChargeRefunded(charge: StripeCharge): Promise<void> {
    const refund = charge.refunds.data[0];
    await this.paymentsService.processRefundFromWebhook(charge.payment_intent, refund);
  }

  private async handleSubscriptionEvent(event: SubscriptionWebhookEvent): Promise<void> {
    await this.paymentsService.handleSubscriptionEvent(event);
  }

  private async handlePayPalWebhook(
    payload: Record<string, unknown>,
    _headers: Record<string, string>,
    webhookRetryId: string,
  ): Promise<void> {
    const paypalPayload = payload as PayPalWebhookPayload;
    this.logger.log(`Processing PayPal webhook: ${paypalPayload.event_type}`);

    switch (paypalPayload.event_type) {
      case 'PAYMENT.SALE.COMPLETED':
        await this.handlePayPalPaymentCompleted(paypalPayload.resource);
        break;
      case 'PAYMENT.SALE.REFUNDED':
        await this.handlePayPalRefundCompleted(paypalPayload.resource);
        break;
      default:
        this.logger.log(`Unhandled PayPal event type: ${paypalPayload.event_type}`);
    }
  }

  private async handlePayPalPaymentCompleted(resource: PayPalResource): Promise<void> {
    await this.paymentsService.updatePaymentStatus(resource.id, PaymentStatus.COMPLETED);
  }

  private async handlePayPalRefundCompleted(resource: PayPalResource): Promise<void> {
    await this.paymentsService.processRefundFromWebhook(resource.parent_payment, {
      id: resource.id,
      amount: resource.amount,
    });
  }
}
