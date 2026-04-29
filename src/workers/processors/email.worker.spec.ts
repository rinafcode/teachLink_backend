import { EmailWorker } from './email.worker';
import { Job } from 'bull';

describe('EmailWorker', () => {
  let worker: EmailWorker;

  beforeEach(() => {
    worker = new EmailWorker();
  });

  it('should process email job successfully', async () => {
    const mockJob = {
      id: '1',
      name: 'send-email',
      data: {
        to: 'test@example.com',
        subject: 'Welcome!',
        template: 'welcome',
        variables: { name: 'John' },
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);

    expect(result.success).toBe(true);
    expect(result.data.to).toBe('test@example.com');
    expect(result.data.subject).toBe('Welcome!');
    expect(result.data.status).toBe('sent');
  });

  it('should fail if email is missing', async () => {
    const mockJob = {
      id: '1',
      name: 'send-email',
      data: {
        subject: 'Welcome!',
        // missing 'to' field
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    await expect(worker.handle(mockJob)).rejects.toThrow(
      'Missing required email fields: to, subject',
    );
  });

  it('should fail if subject is missing', async () => {
    const mockJob = {
      id: '1',
      name: 'send-email',
      data: {
        to: 'test@example.com',
        // missing 'subject' field
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    await expect(worker.handle(mockJob)).rejects.toThrow(
      'Missing required email fields: to, subject',
    );
  });

  it('should track metrics', async () => {
    const mockJob = {
      id: '1',
      name: 'send-email',
      data: { to: 'test@example.com', subject: 'Test' },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    await worker.handle(mockJob);

    const metrics = worker.getMetrics();
    expect(metrics.jobsProcessed).toBe(1);
    expect(metrics.jobsSucceeded).toBe(1);
    expect(metrics.jobsFailed).toBe(0);
  });
});
