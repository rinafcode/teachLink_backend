import { Injectable, Logger } from '@nestjs/common';
import { PaymentsService } from '../payments.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  async handleStripeWebhook(payload: any, signature: string): Promise<any> {
    this.logger.log(`Processing Stripe webhook: ${payload.type}`);

    switch (payload.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(payload.data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(payload.data.object);
        break;
      case 'charge.refunded':
        await this.handleChargeRefunded(payload.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionEvent(payload);
        break;
      default:
        this.logger.log(`Unhandled event type: ${payload.type}`);
    }

    return { received: true };
  }

  private async handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
    // Update payment status to completed
    await this.paymentsService.updatePaymentStatus(
      paymentIntent.id,
      'COMPLETED',
      paymentIntent.metadata,
    );
  }

  private async handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
    // Update payment status to failed
    await this.paymentsService.updatePaymentStatus(
      paymentIntent.id,
      'FAILED',
      paymentIntent.metadata,
    );
  }

  private async handleChargeRefunded(charge: any): Promise<void> {
    // Process refund
    const refund = charge.refunds.data[0];
    await this.paymentsService.processRefundFromWebhook(
      charge.payment_intent,
      refund,
    );
  }

  private async handleSubscriptionEvent(event: any): Promise<void> {
    // Handle subscription events
    await this.paymentsService.handleSubscriptionEvent(event);
  }

  async handlePayPalWebhook(
    payload: any,
    transmissionId: string,
    transmissionTime: string,
    transmissionSig: string,
    certUrl: string,
    authAlgo: string,
  ): Promise<any> {
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

  private async handlePayPalPaymentCompleted(resource: any): Promise<void> {
    // Update payment status to completed
    await this.paymentsService.updatePaymentStatus(
      resource.id,
      'COMPLETED',
      resource,
    );
  }

  private async handlePayPalRefundCompleted(resource: any): Promise<void> {
    // Process refund
    await this.paymentsService.processRefundFromWebhook(
      resource.parent_payment,
      resource,
    );
  }
}