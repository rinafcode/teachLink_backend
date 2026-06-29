import { Injectable } from '@nestjs/common';
import { IPaymentProvider } from './payment-provider.interface';
import { RetryPolicy } from '../../common/utils/retry-policy';

/**
 * Wraps an IPaymentProvider implementation (Stripe, etc.) with retry logic
 * for the network calls that hit the payment gateway. Webhook handling is
 * intentionally excluded — those are inbound calls, not outbound ones we
 * control retries for.
 */
@Injectable()
export class PaymentProviderService {
  private readonly retryPolicy = new RetryPolicy({ service: 'payment' });

  constructor(private readonly provider: IPaymentProvider) {}

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata?: Record<string, any>,
  ) {
    return this.retryPolicy.execute(() =>
      this.provider.createPaymentIntent(amount, currency, metadata),
    );
  }

  async createSubscription(customerId: string, priceId: string, metadata?: Record<string, any>) {
    return this.retryPolicy.execute(() =>
      this.provider.createSubscription(customerId, priceId, metadata),
    );
  }

  async cancelSubscription(subscriptionId: string) {
    return this.retryPolicy.execute(() => this.provider.cancelSubscription(subscriptionId));
  }

  async refundPayment(paymentId: string, amount?: number) {
    return this.retryPolicy.execute(() => this.provider.refundPayment(paymentId, amount));
  }
}
