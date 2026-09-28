import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { IPaymentProvider } from './payment-provider.interface';

@Injectable()
export class StripeProvider implements IPaymentProvider {
  private readonly logger = new Logger(StripeProvider.name);
  private readonly stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-08-27.basil',
    });
  }

  get name(): string {
    return 'stripe';
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata?: Record<string, any>,
  ): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    requiresAction?: boolean;
  }> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata,
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      requiresAction: paymentIntent.status === 'requires_action',
    };
  }

  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, any>,
  ): Promise<{
    subscriptionId: string;
    status: string;
    currentPeriodEnd: Date;
  }> {
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata,
    });

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      await this.stripe.subscriptions.cancel(subscriptionId);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel Stripe subscription ${subscriptionId}`, error);
      return false;
    }
  }

  async pauseSubscription(subscriptionId: string, resumeAt?: Date): Promise<boolean> {
    try {
      const pauseCollection: Stripe.SubscriptionUpdateParams.PauseCollection = {
        behavior: 'keep_as_draft',
      };

      if (resumeAt) {
        pauseCollection.resumes_at = Math.floor(resumeAt.getTime() / 1000);
      }

      const pauseParams: Stripe.SubscriptionUpdateParams = {
        pause_collection: pauseCollection,
      };

      await this.stripe.subscriptions.update(subscriptionId, pauseParams);
      this.logger.log(`Successfully paused Stripe subscription ${subscriptionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to pause Stripe subscription ${subscriptionId}`, error);
      throw error;
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<boolean> {
    try {
      await this.stripe.subscriptions.update(subscriptionId, {
        pause_collection: null,
      });
      this.logger.log(`Successfully resumed Stripe subscription ${subscriptionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to resume Stripe subscription ${subscriptionId}`, error);
      throw error;
    }
  }

  async refundPayment(
    paymentId: string,
    amount?: number,
  ): Promise<{
    refundId: string;
    status: string;
  }> {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentId,
    };

    if (amount) {
      refundParams.amount = Math.round(amount * 100); // Convert to cents
    }

    const refund = await this.stripe.refunds.create(refundParams);

    return {
      refundId: refund.id,
      status: refund.status,
    };
  }

  async handleWebhook(
    payload: any,
    signature: string,
  ): Promise<{
    type: string;
    data: any;
  }> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    return {
      type: event.type,
      data: event.data,
    };
  }

  async verifyWebhookSignature(payload: any, signature: string): Promise<boolean> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET is not configured');
      return false;
    }

    try {
      this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return true;
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error);
      return false;
    }
  }
}
