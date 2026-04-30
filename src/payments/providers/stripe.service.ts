import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Provides stripe operations.
 */
@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly stripeWebhookSecret: string;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripeWebhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!secretKey) {
      this.logger.error('STRIPE_SECRET_KEY is not defined in environment variables');
    }

    this.stripe = new Stripe(secretKey || 'sk_test_placeholder');
  }

  async createPaymentIntent(amount: number, currency: string, metadata: any): Promise<any> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe expects amount in cents
      currency: currency.toLowerCase(),
      metadata,
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      requiresAction: paymentIntent.status === 'requires_action',
    };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<any> {
    const refundData: Stripe.RefundCreateParams = {
      payment_intent: paymentId,
    };

    if (amount) {
      refundData.amount = Math.round(amount * 100);
    }

    const refund = await this.stripe.refunds.create(refundData);

    return {
      refundId: refund.id,
      status: refund.status,
    };
  }

  async handleWebhook(payload: string | Buffer, signature: string): Promise<Stripe.Event> {
    if (!this.stripeWebhookSecret) {
      throw new InternalServerErrorException('Stripe webhook secret is missing');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, this.stripeWebhookSecret);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new Error(`Webhook Error: ${err.message}`);
    }
  }
}
