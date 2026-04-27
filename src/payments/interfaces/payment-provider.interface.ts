export interface IPaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  requiresAction: boolean;
}

export interface IRefundResult {
  refundId: string;
  status: string;
}

export interface IPaymentMetadata {
  userId: string;
  courseId: string;
  [key: string]: string | number | boolean;
}

export interface IPaymentProvider {
  createPaymentIntent(
    amount: number,
    currency: string,
    metadata: IPaymentMetadata,
  ): Promise<IPaymentIntentResult>;
  refundPayment(paymentId: string, amount?: number): Promise<IRefundResult>;
  handleWebhook(
    payload: Record<string, unknown>,
    signature: string,
  ): Promise<Record<string, unknown>>;
}

export interface ISubscriptionWebhookEvent {
  data: {
    object: {
      id: string;
      status: string;
    };
  };
}

export interface IRefundWebhookData {
  id: string;
  amount: number;
}

export interface ICreatePaymentIntentResult {
  paymentId: string;
  clientSecret: string;
  requiresAction: boolean;
}

export interface ICreateSubscriptionResult {
  subscriptionId: string;
  status: string;
  currentPeriodEnd: Date;
}

export interface IProcessRefundResult {
  refundId: string;
  status: string;
  amount: number;
}
