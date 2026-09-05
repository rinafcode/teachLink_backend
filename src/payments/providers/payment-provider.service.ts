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

@Injectable()
export class PaymentProviderService {
  private readonly logger = new Logger(PaymentProviderService.name);

  async chargeCustomer(
    userId: string,
    amount: number,
    _currency: string,
    _metadata: Record<string, unknown> = {},
  ): Promise<ChargeResult> {
    // TODO: replace with real Stripe call:
    //   const intent = await stripe.paymentIntents.create({ amount: Math.round(amount * 100), currency: _currency, metadata: _metadata, ... });
    this.logger.warn(`chargeCustomer called for user ${userId} amount=${amount} - no real provider configured`);
    throw new Error('No payment provider configured. Inject a concrete PaymentProviderService implementation.');
  }

  async issueCredit(
    userId: string,
    amount: number,
    _currency: string,
    _metadata: Record<string, unknown> = {},
  ): Promise<CreditResult> {
    // TODO: replace with real Stripe call:
    //   const credit = await stripe.customers.createBalanceTransaction(customerId, { amount: -Math.round(amount * 100), currency: _currency, metadata: _metadata });
    this.logger.warn(`issueCredit called for user ${userId} amount=${amount} - no real provider configured`);
    throw new Error('No payment provider configured. Inject a concrete PaymentProviderService implementation.');
  }
}
