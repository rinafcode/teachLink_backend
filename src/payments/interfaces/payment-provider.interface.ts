export interface PaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  requiresAction: boolean;
}

export interface RefundResult {
  refundId: string;
  status: string;
}

export interface PaymentMetadata {
  userId: string;
  courseId: string;
  [key: string]: string | number | boolean;
}

export interface PaymentProvider {
  createPaymentIntent(
    amount: number,
    currency: string,
    metadata: PaymentMetadata,
  ): Promise<PaymentIntentResult>;
  refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;
  handleWebhook(
    payload: Record<string, unknown>,
    signature: string,
  ): Promise<Record<string, unknown>>;
}

export interface SubscriptionWebhookEvent {
  data: {
    object: {
      id: string;
      status: string;
    };
  };
}

export interface RefundWebhookData {
  id: string;
  amount: number;
}

export interface CreatePaymentIntentResult {
  paymentId: string;
  clientSecret: string;
  requiresAction: boolean;
}

export interface CreateSubscriptionResult {
  subscriptionId: string;
  status: string;
  currentPeriodEnd: Date;
}

export interface ProcessRefundResult {
  refundId: string;
  status: string;
  amount: number;
}
