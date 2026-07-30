import { Injectable, Logger } from '@nestjs/common';

export interface ChargeResult {
  chargeId: string;
  status: 'succeeded' | 'failed';
  amount: number;
  currency: string;
}

export interface CreditResult {
  creditId: string;
  status: 'applied' | 'scheduled';
  amount: number;
  currency: string;
}

/**
 * PaymentProviderService
 *
 * Thin abstraction over the payment provider (Stripe / PayPal / etc.).
 * The concrete implementation should call the real provider SDK; this
 * default implementation throws so that tests must supply a mock and
 * production deployments must configure a real provider.
 *
 * Issue #1007 — extracted so SubscriptionsService can inject it and
 * tests can mock it without touching the real provider.
 */
@Injectable()
export class PaymentProviderService {
  private readonly logger = new Logger(PaymentProviderService.name);

  /**
   * Charge the customer's default payment method for `amount` (in the
   * subscription's currency).  Returns the provider's charge/payment-intent
   * ID on success, or throws on failure.
   */
  async chargeCustomer(
    userId: string,
    amount: number,
    currency: string,
    metadata: Record<string, unknown> = {},
  ): Promise<ChargeResult> {
    // TODO: replace with real Stripe call:
    //   const intent = await stripe.paymentIntents.create({ amount: Math.round(amount * 100), currency, ... });
    this.logger.warn(
      `chargeCustomer called for user ${userId} amount=${amount} — no real provider configured`,
    );
    throw new Error(
      'No payment provider configured. Inject a concrete PaymentProviderService implementation.',
    );
  }

  /**
   * Issue a credit (balance adjustment or refund) to the customer.
   * Returns the provider credit/balance-transaction ID.
   */
  async issueCredit(
    userId: string,
    amount: number,
    currency: string,
    metadata: Record<string, unknown> = {},
  ): Promise<CreditResult> {
    // TODO: replace with real Stripe call:
    //   const credit = await stripe.customers.createBalanceTransaction(customerId, { amount: -Math.round(amount * 100), currency });
    this.logger.warn(
      `issueCredit called for user ${userId} amount=${amount} — no real provider configured`,
    );
    throw new Error(
      'No payment provider configured. Inject a concrete PaymentProviderService implementation.',
    );
  }
}
