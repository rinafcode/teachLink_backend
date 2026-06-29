import { PaymentProviderService } from './payment-provider.service';
import { IPaymentProvider } from './payment-provider.interface';
import { externalCallRetryCounter } from '../../common/utils/retry-policy';

function buildProvider(overrides: Partial<IPaymentProvider> = {}): IPaymentProvider {
  return {
    name: 'stripe',
    createPaymentIntent: jest.fn(),
    createSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    refundPayment: jest.fn(),
    handleWebhook: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    ...overrides,
  };
}

describe('PaymentProviderService', () => {
  beforeEach(() => {
    externalCallRetryCounter.reset();
  });

  it(
    'retries createPaymentIntent transparently on a single transient 503',
    async () => {
      const createPaymentIntent = jest
        .fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue({ clientSecret: 'cs', paymentIntentId: 'pi' });
      const service = new PaymentProviderService(buildProvider({ createPaymentIntent }));

      const result = await service.createPaymentIntent(1000, 'usd');

      expect(result.paymentIntentId).toBe('pi');
      expect(createPaymentIntent).toHaveBeenCalledTimes(2);
    },
    10000,
  );

  it(
    'propagates the error to the caller after 3 consecutive failures',
    async () => {
      const createPaymentIntent = jest.fn().mockRejectedValue({ status: 503 });
      const service = new PaymentProviderService(buildProvider({ createPaymentIntent }));

      await expect(service.createPaymentIntent(1000, 'usd')).rejects.toEqual({ status: 503 });
      expect(createPaymentIntent).toHaveBeenCalledTimes(4);
    },
    15000,
  );

  it('does not retry a 4xx client error from the gateway', async () => {
    const refundPayment = jest.fn().mockRejectedValue({ status: 400 });
    const service = new PaymentProviderService(buildProvider({ refundPayment }));

    await expect(service.refundPayment('pay_1')).rejects.toEqual({ status: 400 });
    expect(refundPayment).toHaveBeenCalledTimes(1);
  });
});
