import { SubscriptionsWorker } from './subscriptions.worker';

describe('SubscriptionsWorker', () => {
  let worker: SubscriptionsWorker;

  beforeEach(() => {
    worker = new SubscriptionsWorker();
  });

  it('should create subscription', async () => {
    const mockJob = {
      id: '1',
      name: 'subscription-create',
      data: {
        subscriptionId: 'sub_123',
        action: 'create',
        userId: 'user_123',
        planId: 'plan_pro',
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('active');
    expect(result.data.subscriptionId).toBe('sub_123');
  });

  it('should renew subscription', async () => {
    const mockJob = {
      id: '1',
      name: 'subscription-renew',
      data: {
        subscriptionId: 'sub_123',
        action: 'renew',
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('active');
    expect(result.data.action).toBe('renew');
  });

  it('should cancel subscription', async () => {
    const mockJob = {
      id: '1',
      name: 'subscription-cancel',
      data: {
        subscriptionId: 'sub_123',
        action: 'cancel',
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('cancelled');
  });

  it('should upgrade subscription', async () => {
    const mockJob = {
      id: '1',
      name: 'subscription-upgrade',
      data: {
        subscriptionId: 'sub_123',
        action: 'upgrade',
        planId: 'plan_enterprise',
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('active');
    expect(result.data.action).toBe('upgrade');
    expect(result.data.newPlanId).toBe('plan_enterprise');
  });

  it('should downgrade subscription', async () => {
    const mockJob = {
      id: '1',
      name: 'subscription-downgrade',
      data: {
        subscriptionId: 'sub_123',
        action: 'downgrade',
        planId: 'plan_basic',
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('active');
    expect(result.data.action).toBe('downgrade');
    expect(result.data.newPlanId).toBe('plan_basic');
  });

  it('should fail if subscriptionId is missing', async () => {
    const mockJob = {
      id: '1',
      name: 'subscription-action',
      data: {
        action: 'create',
        userId: 'user_123',
        planId: 'plan_pro',
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    await expect(worker.handle(mockJob)).rejects.toThrow(
      'Missing required subscription fields: subscriptionId, action',
    );
  });

  it('should fail for unsupported action', async () => {
    const mockJob = {
      id: '1',
      name: 'subscription-action',
      data: {
        subscriptionId: 'sub_123',
        action: 'unknown-action',
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    await expect(worker.handle(mockJob)).rejects.toThrow(
      'Unsupported subscription action: unknown-action',
    );
  });

  it('should calculate next billing date', async () => {
    const mockJob = {
      id: '1',
      name: 'subscription-create',
      data: {
        subscriptionId: 'sub_123',
        action: 'create',
        userId: 'user_123',
        planId: 'plan_pro',
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.data.nextBillingDate).toBeDefined();
    expect(result.data.nextBillingDate).toBeInstanceOf(Date);
    expect(result.data.nextBillingDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('should apply prorated credit on upgrade', async () => {
    const mockJob = {
      id: '1',
      name: 'subscription-upgrade',
      data: {
        subscriptionId: 'sub_123',
        action: 'upgrade',
        planId: 'plan_enterprise',
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.data.creditApplied).toBeGreaterThan(0);
  });

  it('should apply prorated credit on downgrade', async () => {
    const mockJob = {
      id: '1',
      name: 'subscription-downgrade',
      data: {
        subscriptionId: 'sub_123',
        action: 'downgrade',
        planId: 'plan_basic',
      },
      progress: jest.fn(),
      attemptsMade: 0,
    } as any;

    const result = await worker.handle(mockJob);
    expect(result.data.creditApplied).toBeGreaterThan(0);
  });
});
