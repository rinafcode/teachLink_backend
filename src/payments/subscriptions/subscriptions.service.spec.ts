import { BadRequestException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionsService } from './subscriptions.service';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionInterval,
} from '../entities/subscription.entity';
import { PaymentProviderService } from '../providers/payment-provider.service';

// ---------------------------------------------------------------------------
// Helpers
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
  return new SubscriptionsService(repo as any, outbox as any, provider);
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
    expect(meta).toMatchObject({ subscriptionId: 'sub-1', type: 'subscription_upgrade_proration' });

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
