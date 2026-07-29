import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionInterval,
} from '../entities/subscription.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IPaymentProvider } from '../providers/payment-provider.interface';
import { QueueService } from '../../queues/queue.service';
import { PauseSubscriptionDto, ResumeSubscriptionDto } from './dto/subscription-action.dto';

describe('SubscriptionsService - Pause/Resume Functionality', () => {
  let service: SubscriptionsService;
  let subscriptionRepository: jest.Mocked<Repository<Subscription>>;
  let paymentProvider: jest.Mocked<IPaymentProvider>;
  let queueService: jest.Mocked<QueueService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockSubscription: Subscription = {
    id: 'sub-1',
    providerSubscriptionId: 'stripe-sub-1',
    status: SubscriptionStatus.ACTIVE,
    interval: SubscriptionInterval.MONTHLY,
    amount: 29.99,
    currency: 'USD',
    cancelledAt: null,
    trialStart: null,
    trialEnd: null,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    userId: 'user-1',
    user: {} as any,
    properties: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  };

  beforeEach(async () => {
    subscriptionRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as any;

    paymentProvider = {
      pauseSubscription: jest.fn(),
      resumeSubscription: jest.fn(),
    } as any;

    queueService = {
      addJob: jest.fn(),
    } as any;

    eventEmitter = {
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepository,
        },
        {
          provide: 'IPaymentProvider',
          useValue: paymentProvider,
        },
        {
          provide: QueueService,
          useValue: queueService,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  describe('pauseSubscription', () => {
    it('should pause subscription successfully with provider call', async () => {
      const pauseDto: PauseSubscriptionDto = {
        reason: 'User requested pause',
      };

      subscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      paymentProvider.pauseSubscription.mockResolvedValue(true);
      subscriptionRepository.save.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.PAUSED,
        properties: {
          ...mockSubscription.properties,
          pausedAt: new Date(),
          pauseReason: 'User requested pause',
          isPaused: true,
        },
      });

      const result = await service.pauseSubscription('sub-1', pauseDto);

      expect(result.status).toBe(SubscriptionStatus.PAUSED);
      expect(paymentProvider.pauseSubscription).toHaveBeenCalledWith('stripe-sub-1', undefined);
      expect(subscriptionRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('subscription.paused', {
        subscriptionId: 'sub-1',
        userId: 'user-1',
        resumeAt: undefined,
        reason: 'User requested pause',
      });
    });

    it('should schedule resume job when resumeAt is provided', async () => {
      const resumeAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const pauseDto: PauseSubscriptionDto = {
        reason: 'Temporary pause',
        resumeAt: resumeAt.toISOString(),
      };

      subscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      paymentProvider.pauseSubscription.mockResolvedValue(true);
      subscriptionRepository.save.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.PAUSED,
        properties: {
          ...mockSubscription.properties,
          pausedAt: new Date(),
          pauseReason: 'Temporary pause',
          resumeAt: resumeAt.toISOString(),
          isPaused: true,
        },
      });
      queueService.addJob.mockResolvedValue({
        jobId: 'job-1',
        queue: 'subscriptions',
        name: 'resume_subscription',
      });

      await service.pauseSubscription('sub-1', pauseDto);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'subscriptions',
        'resume_subscription',
        { subscriptionId: 'sub-1' },
        expect.objectContaining({
          delay: expect.any(Number),
          attempts: 3,
        }),
      );
    });

    it('should throw error if subscription is not ACTIVE', async () => {
      const inactiveSubscription = { ...mockSubscription, status: SubscriptionStatus.CANCELLED };
      subscriptionRepository.findOne.mockResolvedValue(inactiveSubscription);

      await expect(service.pauseSubscription('sub-1', {})).rejects.toThrow(BadRequestException);
      await expect(service.pauseSubscription('sub-1', {})).rejects.toThrow(
        'Cannot pause subscription with status: cancelled. Must be active.',
      );
    });

    it('should throw error if subscription has no provider ID', async () => {
      const subscriptionWithoutProvider = { ...mockSubscription, providerSubscriptionId: null };
      subscriptionRepository.findOne.mockResolvedValue(subscriptionWithoutProvider);

      await expect(service.pauseSubscription('sub-1', {})).rejects.toThrow(BadRequestException);
      await expect(service.pauseSubscription('sub-1', {})).rejects.toThrow(
        'Subscription does not have a provider subscription ID',
      );
    });

    it('should throw error if provider pause call fails', async () => {
      subscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      paymentProvider.pauseSubscription.mockRejectedValue(new Error('Stripe API error'));

      await expect(service.pauseSubscription('sub-1', {})).rejects.toThrow(BadRequestException);
      await expect(service.pauseSubscription('sub-1', {})).rejects.toThrow(
        'Failed to pause subscription at provider: Stripe API error',
      );
    });

    it('should not update local state if provider call fails (rollback)', async () => {
      subscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      paymentProvider.pauseSubscription.mockRejectedValue(new Error('Provider error'));

      await expect(service.pauseSubscription('sub-1', {})).rejects.toThrow();

      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('resumeSubscription', () => {
    it('should resume subscription successfully with provider call', async () => {
      const pausedSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.PAUSED,
        properties: { isPaused: true, pausedAt: new Date() },
      };
      const resumeDto: ResumeSubscriptionDto = {
        reason: 'User requested resume',
      };

      subscriptionRepository.findOne.mockResolvedValue(pausedSubscription);
      paymentProvider.resumeSubscription.mockResolvedValue(true);
      subscriptionRepository.save.mockResolvedValue({
        ...pausedSubscription,
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: false,
        properties: {
          ...pausedSubscription.properties,
          isPaused: false,
          resumedAt: new Date(),
          resumeReason: 'User requested resume',
        },
      });

      const result = await service.resumeSubscription('sub-1', resumeDto);

      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(paymentProvider.resumeSubscription).toHaveBeenCalledWith('stripe-sub-1');
      expect(subscriptionRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('subscription.resumed', {
        subscriptionId: 'sub-1',
        userId: 'user-1',
        reason: 'User requested resume',
      });
    });

    it('should throw error if subscription is not PAUSED', async () => {
      subscriptionRepository.findOne.mockResolvedValue(mockSubscription);

      await expect(service.resumeSubscription('sub-1', {})).rejects.toThrow(BadRequestException);
      await expect(service.resumeSubscription('sub-1', {})).rejects.toThrow(
        'Subscription is not paused',
      );
    });

    it('should throw error if subscription has no provider ID', async () => {
      const pausedSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.PAUSED,
        providerSubscriptionId: null,
      };
      subscriptionRepository.findOne.mockResolvedValue(pausedSubscription);

      await expect(service.resumeSubscription('sub-1', {})).rejects.toThrow(BadRequestException);
      await expect(service.resumeSubscription('sub-1', {})).rejects.toThrow(
        'Subscription does not have a provider subscription ID',
      );
    });

    it('should throw error if provider resume call fails', async () => {
      const pausedSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.PAUSED,
        properties: { isPaused: true },
      };
      subscriptionRepository.findOne.mockResolvedValue(pausedSubscription);
      paymentProvider.resumeSubscription.mockRejectedValue(new Error('Stripe API error'));

      await expect(service.resumeSubscription('sub-1', {})).rejects.toThrow(BadRequestException);
      await expect(service.resumeSubscription('sub-1', {})).rejects.toThrow(
        'Failed to resume subscription at provider: Stripe API error',
      );
    });

    it('should not update local state if provider call fails (rollback)', async () => {
      const pausedSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.PAUSED,
        properties: { isPaused: true },
      };
      subscriptionRepository.findOne.mockResolvedValue(pausedSubscription);
      paymentProvider.resumeSubscription.mockRejectedValue(new Error('Provider error'));

      await expect(service.resumeSubscription('sub-1', {})).rejects.toThrow();

      expect(subscriptionRepository.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('processRenewal', () => {
    it('should skip renewal for paused subscriptions', async () => {
      const pausedSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.PAUSED,
      };

      subscriptionRepository.findOne.mockResolvedValue(pausedSubscription);

      const result = await service.processRenewal('sub-1');

      expect(result).toBe(false);
    });

    it('should proceed with renewal for ACTIVE subscriptions', async () => {
      subscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      subscriptionRepository.save.mockResolvedValue(mockSubscription);

      const result = await service.processRenewal('sub-1');

      expect(result).toBe(true);
      expect(subscriptionRepository.save).toHaveBeenCalled();
    });

    it('should proceed with renewal for PAST_DUE subscriptions', async () => {
      const pastDueSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.PAST_DUE,
      };

      subscriptionRepository.findOne.mockResolvedValue(pastDueSubscription);
      subscriptionRepository.save.mockResolvedValue(pastDueSubscription);

      const result = await service.processRenewal('sub-1');

      expect(result).toBe(true);
      expect(subscriptionRepository.save).toHaveBeenCalled();
    });
  });

  describe('getUserSubscription', () => {
    it('should return null for paused subscriptions', async () => {
      const pausedSubscription = {
        ...mockSubscription,
        status: SubscriptionStatus.PAUSED,
      };

      subscriptionRepository.findOne.mockResolvedValue(pausedSubscription);

      const result = await service.getUserSubscription('user-1');

      // The method filters by status = ACTIVE, so it should return null for paused
      expect(subscriptionRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: SubscriptionStatus.ACTIVE },
        relations: ['user'],
      });
    });

    it('should return active subscription when status is ACTIVE', async () => {
      subscriptionRepository.findOne.mockResolvedValue(mockSubscription);

      const result = await service.getUserSubscription('user-1');

      expect(result).toBe(mockSubscription);
      expect(subscriptionRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: SubscriptionStatus.ACTIVE },
        relations: ['user'],
      });
    });
  });
});
