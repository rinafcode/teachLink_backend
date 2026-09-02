import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription, SubscriptionStatus, SubscriptionInterval } from '../entities/subscription.entity';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';

describe('SubscriptionsService', () => {
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

      await expect(
        service.pauseSubscription('sub-1', { resumeAt: pastDate }),
      ).rejects.toThrow(BadRequestException);
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

      await expect(
        service.resumeSubscription('sub-1', { reason: 'Back now' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should resume paused subscription successfully', async () => {
      const sub = {
        id: 'sub-1',
        userId: 'user-1',
        status: SubscriptionStatus.ACTIVE,
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
