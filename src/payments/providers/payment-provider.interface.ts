export interface PaymentProvider {
  name: string;
  
  createPaymentIntent(
    amount: number,
    currency: string,
    metadata?: Record<string, any>,
  ): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    requiresAction?: boolean;
  }>;

  createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, any>,
  ): Promise<{
    subscriptionId: string;
    status: string;
    currentPeriodEnd: Date;
  }>;

  cancelSubscription(subscriptionId: string): Promise<boolean>;
  
  refundPayment(
    paymentId: string,
    amount?: number,
  ): Promise<{
    refundId: string;
    status: string;
  }>;

  handleWebhook(
    payload: any,
    signature: string,
  ): Promise<{
    type: string;
    data: any;
  }>;

  verifyWebhookSignature(
    payload: any,
    signature: string,
  ): Promise<boolean>;
}