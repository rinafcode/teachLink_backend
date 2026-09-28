import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from 'bull';
import { SubscriptionJobProcessor } from './subscription-job.processor';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription, SubscriptionStatus } from '../entities/subscription.entity';

describe('SubscriptionJobProcessor', () => {
  let processor: SubscriptionJobProcessor;

  const mockSubscriptionsService = {
    resumeSubscription: jest.fn(),
  };

  const mockSubscriptionRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionJobProcessor,
        {
          provide: SubscriptionsService,
          useValue: mockSubscriptionsService,
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubscriptionRepository,
        },
      ],
    }).compile();

    processor = module.get<SubscriptionJobProcessor>(SubscriptionJobProcessor);
  });

  describe('handleSubscription', () => {
    it('should process default subscription job', async () => {
      const job = { data: { test: true } } as Job<unknown>;
      const result = await processor.handleSubscription(job);
      expect(result).toEqual({ success: true });
    });
  });

  describe('handleResumeSubscription', () => {
    it('should return error if subscriptionId is missing', async () => {
      const job = { data: {} } as Job<any>;
      const result = await processor.handleResumeSubscription(job);
      expect(result).toEqual({ success: false, reason: 'Missing subscriptionId' });
      expect(mockSubscriptionRepository.findOne).not.toHaveBeenCalled();
      expect(mockSubscriptionsService.resumeSubscription).not.toHaveBeenCalled();
    });

    it('should handle missing subscription safely as no-op', async () => {
      mockSubscriptionRepository.findOne.mockResolvedValue(null);
      const job = { data: { subscriptionId: 'sub-missing' } } as Job<any>;

      const result = await processor.handleResumeSubscription(job);

      expect(result).toEqual({ success: false, reason: 'Subscription not found' });
      expect(mockSubscriptionsService.resumeSubscription).not.toHaveBeenCalled();
    });

    it('should safely handle cancelled subscription as no-op', async () => {
      mockSubscriptionRepository.findOne.mockResolvedValue({
        id: 'sub-cancelled',
        status: SubscriptionStatus.CANCELLED,
        properties: { isPaused: true },
      });
      const job = { data: { subscriptionId: 'sub-cancelled' } } as Job<any>;

      const result = await processor.handleResumeSubscription(job);

      expect(result).toEqual({ success: false, reason: 'Subscription cancelled' });
      expect(mockSubscriptionsService.resumeSubscription).not.toHaveBeenCalled();
    });

    it('should be idempotent and no-op if subscription is already active / not paused', async () => {
      mockSubscriptionRepository.findOne.mockResolvedValue({
        id: 'sub-active',
        status: SubscriptionStatus.ACTIVE,
        properties: { isPaused: false },
      });
      const job = { data: { subscriptionId: 'sub-active' } } as Job<any>;

      const result = await processor.handleResumeSubscription(job);

      expect(result).toEqual({ success: true, reason: 'Subscription not paused' });
      expect(mockSubscriptionsService.resumeSubscription).not.toHaveBeenCalled();
    });

    it('should successfully resume a paused subscription', async () => {
      mockSubscriptionRepository.findOne.mockResolvedValue({
        id: 'sub-paused',
        status: SubscriptionStatus.ACTIVE,
        properties: { isPaused: true, resumeAt: '2026-09-02T16:00:00.000Z' },
      });
      mockSubscriptionsService.resumeSubscription.mockResolvedValue({
        id: 'sub-paused',
        status: SubscriptionStatus.ACTIVE,
        properties: { isPaused: false },
      });

      const job = {
        data: { subscriptionId: 'sub-paused', userId: 'user-1', reason: 'Automatic resume' },
      } as Job<any>;

      const result = await processor.handleResumeSubscription(job);

      expect(result).toEqual({ success: true });
      expect(mockSubscriptionsService.resumeSubscription).toHaveBeenCalledWith('sub-paused', {
        reason: 'Automatic resume',
      });
    });

    it('should throw error when resumeSubscription fails so Bull can retry', async () => {
      mockSubscriptionRepository.findOne.mockResolvedValue({
        id: 'sub-paused',
        status: SubscriptionStatus.ACTIVE,
        properties: { isPaused: true },
      });
      mockSubscriptionsService.resumeSubscription.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const job = { data: { subscriptionId: 'sub-paused' } } as Job<any>;

      await expect(processor.handleResumeSubscription(job)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
