import { EmailService, EmailProvider, EmailMessage } from './email.service';
import { externalCallRetryCounter } from '../../common/utils/retry-policy';

describe('EmailService', () => {
  const message: EmailMessage = { to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>' };

  beforeEach(() => {
    externalCallRetryCounter.reset();
  });

  it(
    'retries transparently on a single transient 503 from the provider',
    async () => {
      const provider: EmailProvider = { send: jest.fn() };
      (provider.send as jest.Mock)
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue(undefined);
      const service = new EmailService(provider);

      await service.send(message);

      expect(provider.send).toHaveBeenCalledTimes(2);
    },
    10000,
  );

  it(
    'propagates the error after 3 consecutive failures',
    async () => {
      const provider: EmailProvider = { send: jest.fn().mockRejectedValue({ status: 503 }) };
      const service = new EmailService(provider);

      await expect(service.send(message)).rejects.toEqual({ status: 503 });
      expect(provider.send).toHaveBeenCalledTimes(4);
    },
    15000,
  );

  it('does not retry a 4xx client error', async () => {
    const provider: EmailProvider = { send: jest.fn().mockRejectedValue({ status: 422 }) };
    const service = new EmailService(provider);

    await expect(service.send(message)).rejects.toEqual({ status: 422 });
    expect(provider.send).toHaveBeenCalledTimes(1);
  });
});
