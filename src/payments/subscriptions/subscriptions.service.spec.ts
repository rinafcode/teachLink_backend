import { BadRequestException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { SubscriptionsService } from './subscriptions.service';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionInterval,
} from '../entities/subscription.entity';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';
import { OutboxService } from '../../common/events/outbox.service';
import { PaymentProviderService } from '../providers/payment-provider.service';

describe('SubscriptionsService (Lifecycle & Pause/Resume)', () => {
  let service: SubscriptionsService;

  const mockSubscriptionRepository = {
    findOne: jest.fn(),
    save: jest.fn((sub) => Promise.resolve(sub)),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  const mockOutbox = {
    enqueueStandalone: jest.fn().mockResolvedValue(undefined),
    enqueue: jest.fn().mockResolvedValue(undefined),
  };

  const mockPaymentProvider = {
    chargeCustomer: jest.fn(),
    issueCredit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubscriptionRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.SUBSCRIPTIONS),
          useValue: mockQueue,
        },
        {
          provide: OutboxService,
          useValue: mockOutbox,
        },
        {
          provide: PaymentProviderService,
          useValue: mockPaymentProvider,
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  describe('pauseSubscription', () => {
    it('should throw BadRequestException if subscription is not ACTIVE', async () => {
      mockSubscriptionRepository.findOne.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: SubscriptionStatus.CANCELLED,
      });

      await expect(
        service.pauseSubscription('sub-1', { reason: 'Going on holiday' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if resumeAt is in the past', async () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();
      mockSubscriptionRepository.findOne.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: SubscriptionStatus.ACTIVE,
      });

      await expect(service.pauseSubscription('sub-1', { resumeAt: pastDate })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if resumeAt is invalid date format', async () => {
      mockSubscriptionRepository.findOne.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: SubscriptionStatus.ACTIVE,
      });

      await expect(
        service.pauseSubscription('sub-1', { resumeAt: 'invalid-date' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should pause subscription without resumeAt and not schedule any queue job', async () => {
      const sub = {
        id: 'sub-1',
        userId: 'user-1',
        status: SubscriptionStatus.ACTIVE,
        properties: {},
      };
      mockSubscriptionRepository.findOne.mockResolvedValue(sub);

      const result = await service.pauseSubscription('sub-1', { reason: 'Financial break' });

      expect(result.properties?.isPaused).toBe(true);
      expect(result.properties?.pauseReason).toBe('Financial break');
      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'subscription.paused',
        expect.objectContaining({
          subscriptionId: 'sub-1',
          userId: 'user-1',
          reason: 'Financial break',
        }),
      );
    });

    it('should pause subscription and schedule delayed RESUME_SUBSCRIPTION job when future resumeAt is provided', async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days in future
      const sub = {
        id: 'sub-1',
        userId: 'user-1',
        status: SubscriptionStatus.ACTIVE,
        properties: {},
      };
      mockSubscriptionRepository.findOne.mockResolvedValue(sub);

      const result = await service.pauseSubscription('sub-1', {
        reason: 'Temporary break',
        resumeAt: futureDate.toISOString(),
      });

      expect(result.properties?.isPaused).toBe(true);
      expect(result.properties?.resumeAt).toBe(futureDate.toISOString());
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        JOB_NAMES.RESUME_SUBSCRIPTION,
        {
          subscriptionId: 'sub-1',
          userId: 'user-1',
        },
        expect.objectContaining({
          delay: expect.any(Number),
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
        }),
      );

      const callArgs = mockQueue.add.mock.calls[0];
      expect(callArgs[2].delay).toBeGreaterThan(0);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'subscription.paused',
        expect.objectContaining({
          subscriptionId: 'sub-1',
          userId: 'user-1',
          resumeAt: futureDate.toISOString(),
        }),
      );
    });
  });

  describe('resumeSubscription', () => {
    it('should throw BadRequestException if subscription is not paused', async () => {
      mockSubscriptionRepository.findOne.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: SubscriptionStatus.ACTIVE,
        properties: { isPaused: false },
      });

      await expect(service.resumeSubscription('sub-1', { reason: 'Back now' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should resume paused subscription successfully', async () => {
      const sub = {
        id: 'sub-1',
        userId: 'user-1',
        status: SubscriptionStatus.PAUSED,
        properties: { isPaused: true, pausedAt: new Date() },
      };
      mockSubscriptionRepository.findOne.mockResolvedValue(sub);

      const result = await service.resumeSubscription('sub-1', { reason: 'Ready to continue' });

      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.properties?.isPaused).toBe(false);
      expect(result.properties?.resumeReason).toBe('Ready to continue');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'subscription.resumed',
        expect.objectContaining({
          subscriptionId: 'sub-1',
          userId: 'user-1',
          reason: 'Ready to continue',
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Helpers for proration/upgrade/downgrade suites
// ---------------------------------------------------------------------------

const PERIOD_END = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days from now

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    userId: 'user-1',
    status: SubscriptionStatus.ACTIVE,
    interval: SubscriptionInterval.MONTHLY,
    amount: 9.99, // plan-basic monthly
    currency: 'USD',
    currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: PERIOD_END,
    cancelledAt: null as any,
    trialStart: null as any,
    trialEnd: null as any,
    cancelAtPeriodEnd: false,
    properties: {},
    providerSubscriptionId: 'prov-sub-1',
    version: 1,
    user: {} as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    ...overrides,
  } as Subscription;
}

function makeRepo(subscription: Subscription) {
  return {
    findOne: jest.fn().mockResolvedValue(subscription),
    save: jest.fn().mockImplementation(async (s: Subscription) => ({ ...s })),
  };
}

function makeOutbox() {
  return {
    enqueueStandalone: jest.fn().mockResolvedValue(undefined),
    enqueue: jest.fn().mockResolvedValue(undefined),
  };
}

function makeProvider() {
  return {
    chargeCustomer: jest.fn(),
    issueCredit: jest.fn(),
  } as unknown as jest.Mocked<PaymentProviderService>;
}

function buildService(
  repo: ReturnType<typeof makeRepo>,
  outbox: ReturnType<typeof makeOutbox>,
  provider: jest.Mocked<PaymentProviderService>,
): SubscriptionsService {
  return new SubscriptionsService(
    repo as any,
    { emit: jest.fn() } as any,
    { add: jest.fn() } as any,
    outbox as any,
    provider,
  );
}

// ---------------------------------------------------------------------------
// upgradeSubscription
// ---------------------------------------------------------------------------

describe('SubscriptionsService.upgradeSubscription', () => {
  it('charges the prorated difference and saves the new plan on success', async () => {
    const subscription = makeSubscription();
    const repo = makeRepo(subscription);
    const outbox = makeOutbox();
    const provider = makeProvider();

    provider.chargeCustomer.mockResolvedValue({
      chargeId: 'ch_test_123',
      status: 'succeeded',
      amount: expect.any(Number),
      currency: 'USD',
    });

    const service = buildService(repo, outbox, provider);

    const result = await service.upgradeSubscription('sub-1', {
      planId: 'plan-pro', // $19.99 > $9.99 — valid upgrade
    });

    // Charge must happen
    expect(provider.chargeCustomer).toHaveBeenCalledTimes(1);
    const [userId, amount, currency, meta] = provider.chargeCustomer.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(amount).toBeGreaterThan(0);
    expect(currency).toBe('USD');
    expect(meta).toMatchObject({
      subscriptionId: 'sub-1',
      type: 'subscription_upgrade_proration',
    });

    // Plan change persisted
    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved: Subscription = repo.save.mock.calls[0][0];
    expect(saved.amount).toBe(19.99);
    expect(saved.properties?.upgradeChargeId).toBe('ch_test_123');
    expect(saved.properties?.proratedAmount).toBeGreaterThan(0);

    // Event enqueued with chargeId
    expect(outbox.enqueueStandalone).toHaveBeenCalledWith(
      'subscription.upgraded',
      expect.objectContaining({ chargeId: 'ch_test_123', planId: 'plan-pro' }),
    );

    // Returned subscription reflects new amount
    expect(result.amount).toBe(19.99);
  });

  it('leaves the subscription on the original plan when the charge fails', async () => {
    const subscription = makeSubscription();
    const repo = makeRepo(subscription);
    const outbox = makeOutbox();
    const provider = makeProvider();

    provider.chargeCustomer.mockRejectedValue(new Error('Card declined'));

    const service = buildService(repo, outbox, provider);

    await expect(
      service.upgradeSubscription('sub-1', { planId: 'plan-pro' }),
    ).rejects.toBeInstanceOf(HttpException);

    // Subscription must NOT be saved after a failed charge
    expect(repo.save).not.toHaveBeenCalled();

    // No event should be enqueued for a failed upgrade
    expect(outbox.enqueueStandalone).not.toHaveBeenCalledWith(
      'subscription.upgraded',
      expect.anything(),
    );
  });

  it('throws BadRequestException if new plan is not more expensive', async () => {
    const subscription = makeSubscription({ amount: 19.99 }); // already pro
    const repo = makeRepo(subscription);
    const provider = makeProvider();

    const service = buildService(repo, makeOutbox(), provider);

    await expect(
      service.upgradeSubscription('sub-1', { planId: 'plan-basic' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(provider.chargeCustomer).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when subscription does not exist', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() };
    const service = buildService(repo as any, makeOutbox(), makeProvider());

    await expect(
      service.upgradeSubscription('sub-missing', { planId: 'plan-pro' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// downgradeSubscription — immediate credit
// ---------------------------------------------------------------------------

describe('SubscriptionsService.downgradeSubscription (credit)', () => {
  it('issues a prorated credit and saves the lower plan immediately', async () => {
    const subscription = makeSubscription({ amount: 19.99 }); // plan-pro
    const repo = makeRepo(subscription);
    const outbox = makeOutbox();
    const provider = makeProvider();

    provider.issueCredit.mockResolvedValue({
      creditId: 'cre_test_456',
      status: 'applied',
      amount: expect.any(Number),
      currency: 'USD',
    });

    const service = buildService(repo, outbox, provider);

    const result = await service.downgradeSubscription('sub-1', {
      planId: 'plan-basic', // $9.99 < $19.99 — valid downgrade
      prorationType: 'credit',
    });

    // Credit must be issued
    expect(provider.issueCredit).toHaveBeenCalledTimes(1);
    const [userId, amount, currency, meta] = provider.issueCredit.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(amount).toBeGreaterThan(0);
    expect(currency).toBe('USD');
    expect(meta).toMatchObject({
      subscriptionId: 'sub-1',
      type: 'subscription_downgrade_proration',
    });

    // Plan change persisted
    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved: Subscription = repo.save.mock.calls[0][0];
    expect(saved.amount).toBe(9.99);
    expect(saved.properties?.downgradeCreditId).toBe('cre_test_456');
    expect(saved.properties?.proratedCredit).toBeGreaterThan(0);

    // Event enqueued with creditId
    expect(outbox.enqueueStandalone).toHaveBeenCalledWith(
      'subscription.downgraded',
      expect.objectContaining({
        creditId: 'cre_test_456',
        deferred: false,
        prorationType: 'credit',
      }),
    );

    expect(result.amount).toBe(9.99);
  });

  it('leaves the subscription unchanged when credit issuance fails', async () => {
    const subscription = makeSubscription({ amount: 19.99 });
    const repo = makeRepo(subscription);
    const outbox = makeOutbox();
    const provider = makeProvider();

    provider.issueCredit.mockRejectedValue(new Error('Provider unavailable'));

    const service = buildService(repo, outbox, provider);

    await expect(
      service.downgradeSubscription('sub-1', { planId: 'plan-basic', prorationType: 'credit' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Subscription must NOT be saved after a failed credit
    expect(repo.save).not.toHaveBeenCalled();
    expect(outbox.enqueueStandalone).not.toHaveBeenCalledWith(
      'subscription.downgraded',
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// downgradeSubscription — deferred (prorationType: 'none')
// ---------------------------------------------------------------------------

describe('SubscriptionsService.downgradeSubscription (deferred, prorationType=none)', () => {
  it('records a pendingDowngrade and defers the plan change without issuing a credit', async () => {
    const subscription = makeSubscription({ amount: 19.99 });
    const repo = makeRepo(subscription);
    const outbox = makeOutbox();
    const provider = makeProvider();

    const service = buildService(repo, outbox, provider);

    const result = await service.downgradeSubscription('sub-1', {
      planId: 'plan-basic',
      prorationType: 'none',
    });

    // No provider call should occur for deferred downgrades
    expect(provider.issueCredit).not.toHaveBeenCalled();
    expect(provider.chargeCustomer).not.toHaveBeenCalled();

    // Subscription saved with pending downgrade metadata
    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved: Subscription = repo.save.mock.calls[0][0];
    expect(saved.amount).toBe(19.99); // amount unchanged until period end
    expect(saved.properties?.pendingDowngrade).toMatchObject({
      planId: 'plan-basic',
      amount: 9.99,
    });
    expect(saved.properties?.pendingDowngrade?.effectiveAt).toEqual(PERIOD_END);
    expect(saved.properties?.prorationType).toBe('none');

    // Event indicates deferred change
    expect(outbox.enqueueStandalone).toHaveBeenCalledWith(
      'subscription.downgraded',
      expect.objectContaining({
        deferred: true,
        prorationType: 'none',
        effectiveAt: PERIOD_END,
      }),
    );

    // Plan amount is still the original — not yet changed
    expect(result.amount).toBe(19.99);
  });

  it('defaults prorationType to "credit" when not supplied', async () => {
    const subscription = makeSubscription({ amount: 19.99 });
    const repo = makeRepo(subscription);
    const outbox = makeOutbox();
    const provider = makeProvider();

    provider.issueCredit.mockResolvedValue({
      creditId: 'cre_default',
      status: 'applied',
      amount: 5,
      currency: 'USD',
    });

    const service = buildService(repo, outbox, provider);

    // prorationType not supplied → should default to 'credit'
    await service.downgradeSubscription('sub-1', { planId: 'plan-basic' });

    expect(provider.issueCredit).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved: Subscription = repo.save.mock.calls[0][0];
    expect(saved.amount).toBe(9.99);
  });
});

describe('SubscriptionsService proration precision', () => {
  it('calculates prorated charges and credits with exact decimal precision', async () => {
    // 10 days remaining out of 30
    const currentPeriodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const subscription = makeSubscription({
      amount: 9.99,
      interval: SubscriptionInterval.MONTHLY,
      currentPeriodEnd,
    });
    const repo = makeRepo(subscription);
    const outbox = makeOutbox();
    const provider = makeProvider();

    provider.chargeCustomer.mockResolvedValue({
      chargeId: 'ch_proration_test',
      status: 'succeeded',
      amount: expect.any(Number),
      currency: 'USD',
    });

    const service = buildService(repo, outbox, provider);

    await service.upgradeSubscription('sub-1', {
      planId: 'plan-pro', // 19.99
    });

    expect(provider.chargeCustomer).toHaveBeenCalledTimes(1);
    const [, chargedAmount] = provider.chargeCustomer.mock.calls[0];
    // old prorated = (9.99 * 10) / 30 = 3.33
    // new prorated = (19.99 * 10) / 30 = 6.66333... -> 6.66
    // net charge = 6.66 - 3.33 = 3.33
    expect(chargedAmount).toBe(3.33);
  });
});
