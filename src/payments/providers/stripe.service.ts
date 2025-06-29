import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentMethod, PaymentStatus } from '../entities/payment.entity';
import { BillingInterval, SubscriptionStatus } from '../entities/subscription.entity';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-05-28.basil',
    });
  }

  async createPaymentIntent(amount: number, currency: string, metadata: any): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), 
        currency: currency.toLowerCase(),
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Failed to create payment intent: ${error.message}`);
      throw new BadRequestException('Failed to create payment intent');
    }
  }

  async confirmPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status === 'succeeded') {
        return paymentIntent;
      }
      throw new BadRequestException('Payment not completed');
    } catch (error) {
      this.logger.error(`Failed to confirm payment: ${error.message}`);
      throw new BadRequestException('Failed to confirm payment');
    }
  }

  async createCustomer(email: string, name?: string): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.create({
        email,
        name,
      });
    } catch (error) {
      this.logger.error(`Failed to create customer: ${error.message}`);
      throw new BadRequestException('Failed to create customer');
    }
  }

  async createSubscription(
    customerId: string,
    priceId: string,
    metadata: any,
    trialEnd?: number,
  ): Promise<Stripe.Subscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        metadata,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      };

      if (trialEnd) {
        subscriptionData.trial_end = trialEnd;
      }

      return await this.stripe.subscriptions.create(subscriptionData);
    } catch (error) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
      throw new BadRequestException('Failed to create subscription');
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      this.logger.error(`Failed to cancel subscription: ${error.message}`);
      throw new BadRequestException('Failed to cancel subscription');
    }
  }

  async createRefund(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    try {
      const refundData: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };
      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }
      return await this.stripe.refunds.create(refundData);
    } catch (error) {
      this.logger.error(`Failed to create refund: ${error.message}`);
      throw new BadRequestException('Failed to create refund');
    }
  }

  async createInvoice(customerId: string, amount: number, currency: string, description: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.create({
        customer: customerId,
        collection_method: 'charge_automatically',
        auto_advance: true,
      });

      await this.stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        description,
      });

      return await this.stripe.invoices.finalizeInvoice(invoice.id);
    } catch (error) {
      this.logger.error(`Failed to create invoice: ${error.message}`);
      throw new BadRequestException('Failed to create invoice');
    }
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<Stripe.Event> {
    try {
      const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
      }
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }
  }
} 