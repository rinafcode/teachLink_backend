import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentProvider } from './payment-provider.interface';

@Injectable()
export class StripeService implements PaymentProvider {
  public readonly name = 'stripe';
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-06-30.basil',
    });
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata?: Record<string, any>,
  ) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        requiresAction: paymentIntent.status === 'requires_action',
      };
    } catch (error) {
      this.logger.error('Failed to create payment intent', error);
      throw error;
    }
  }

  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, any>,
  ) {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata,
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      return {
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodEnd: (subscription && (subscription as any).current_period_end)
          ? new Date((subscription as any).current_period_end * 1000)
          : null,
      };
    } catch (error) {
      this.logger.error('Failed to create subscription', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      await this.stripe.subscriptions.cancel(subscriptionId);
      return true;
    } catch (error) {
      this.logger.error('Failed to cancel subscription', error);
      throw error;
    }
  }

  async refundPayment(paymentId: string, amount?: number) {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      return {
        refundId: refund.id,
        status: refund.status,
      };
    } catch (error) {
      this.logger.error('Failed to process refund', error);
      throw error;
    }
  }

  async handleWebhook(payload: any, signature: string) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret,
      );

      return {
        type: event.type,
        data: event.data.object,
      };
    } catch (error) {
      this.logger.error('Failed to handle webhook', error);
      throw error;
    }
  }

  async verifyWebhookSignature(payload: any, signature: string): Promise<boolean> {
    try {
      this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
      return true;
    } catch {
      return false;
    }
  }
}