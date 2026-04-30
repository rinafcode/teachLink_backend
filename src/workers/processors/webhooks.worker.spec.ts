import { WebhooksWorker } from './webhooks.worker';

describe('WebhooksWorker', () => {
  let worker: WebhooksWorker;

  beforeEach(() => {
    worker = new WebhooksWorker();
  });

  it('should deliver webhook', async () => {
    const mockJob = {
      id: '1',
      name: 'call-webhook',
      data: {
        url: 'https://example.com/webhook',
        event: 'user.created',
        payload: { userId: 123, email: 'test@example.com' },
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.delivered).toBe(true);
    expect(result.data.event).toBe('user.created');
  });

  it('should include custom headers', async () => {
    const mockJob = {
      id: '1',
      name: 'call-webhook',
      data: {
        url: 'https://example.com/webhook',
        event: 'payment.completed',
        payload: { transactionId: 'txn_123' },
        headers: { 'X-Webhook-Secret': 'secret-key' },
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.delivered).toBe(true);
  });

  it('should track retry count', async () => {
    const mockJob = {
      id: '1',
      name: 'call-webhook',
      data: {
        url: 'https://example.com/webhook',
        event: 'test.event',
        payload: {},
      },
      progress: jest.fn(),
      attemptsMade: 2,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.data.retryCount).toBe(2);
  });

  it('should fail if url is missing', async () => {
    const mockJob = {
      id: '1',
      name: 'call-webhook',
      data: {
        event: 'user.created',
        payload: {},
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    await expect(worker.handle(mockJob)).rejects.toThrow(
      'Missing required webhook fields: url, event, payload',
    );
  });

  it('should record delivery time', async () => {
    const mockJob = {
      id: '1',
      name: 'call-webhook',
      data: {
        url: 'https://example.com/webhook',
        event: 'test.event',
        payload: {},
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.data.deliveredAt).toBeDefined();
    expect(result.data.deliveredAt).toBeInstanceOf(Date);
  });
});
