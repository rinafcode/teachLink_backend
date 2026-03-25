import { Injectable, Logger } from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { PaymentStatus } from '../entities/payment.entity';
import {
  SubscriptionWebhookEvent,
  RefundWebhookData,
} from '../interfaces/payment-provider.interface';

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

interface StripeWebhookPayload {
  type: string;
  data: {
    object: StripePaymentIntent | StripeCharge;
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

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  async handleStripeWebhook(
    payload: StripeWebhookPayload,
    _signature: string,
  ): Promise<{ received: boolean }> {
    this.logger.log(`Processing Stripe webhook: ${payload.type}`);

    switch (payload.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(payload.data.object as StripePaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(payload.data.object as StripePaymentIntent);
        break;
      case 'charge.refunded':
        await this.handleChargeRefunded(payload.data.object as StripeCharge);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionEvent(payload as unknown as SubscriptionWebhookEvent);
        break;
      default:
        this.logger.log(`Unhandled event type: ${payload.type}`);
    }

    return { received: true };
  }

  private async handlePaymentIntentSucceeded(paymentIntent: StripePaymentIntent): Promise<void> {
    // Update payment status to completed
    await this.paymentsService.updatePaymentStatus(
      paymentIntent.id,
      PaymentStatus.COMPLETED,
      paymentIntent.metadata,
    );
  }

  private async handlePaymentIntentFailed(paymentIntent: StripePaymentIntent): Promise<void> {
    // Update payment status to failed
    await this.paymentsService.updatePaymentStatus(
      paymentIntent.id,
      PaymentStatus.FAILED,
      paymentIntent.metadata,
    );
  }

  private async handleChargeRefunded(charge: StripeCharge): Promise<void> {
    // Process refund
    const refund = charge.refunds.data[0];
    await this.paymentsService.processRefundFromWebhook(charge.payment_intent, refund);
  }

  private async handleSubscriptionEvent(event: SubscriptionWebhookEvent): Promise<void> {
    // Handle subscription events
    await this.paymentsService.handleSubscriptionEvent(event);
  }

  async handlePayPalWebhook(
    payload: PayPalWebhookPayload,
    _transmissionId: string,
    _transmissionTime: string,
    _transmissionSig: string,
    _certUrl: string,
    _authAlgo: string,
  ): Promise<{ received: boolean }> {
    this.logger.log(`Processing PayPal webhook: ${payload.event_type}`);

    switch (payload.event_type) {
      case 'PAYMENT.SALE.COMPLETED':
        await this.handlePayPalPaymentCompleted(payload.resource);
        break;
      case 'PAYMENT.SALE.REFUNDED':
        await this.handlePayPalRefundCompleted(payload.resource);
        break;
      default:
        this.logger.log(`Unhandled PayPal event type: ${payload.event_type}`);
    }

    return { received: true };
  }

  private async handlePayPalPaymentCompleted(resource: PayPalResource): Promise<void> {
    // Update payment status to completed
    await this.paymentsService.updatePaymentStatus(resource.id, PaymentStatus.COMPLETED);
  }

  private async handlePayPalRefundCompleted(resource: PayPalResource): Promise<void> {
    // Process refund
    await this.paymentsService.processRefundFromWebhook(resource.parent_payment, {
      id: resource.id,
      amount: resource.amount,
    });
  }
}
