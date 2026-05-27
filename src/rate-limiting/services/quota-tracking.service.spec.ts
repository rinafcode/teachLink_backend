import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuotaTrackingService } from './quota-tracking.service';
import { QuotaDefinitionService } from './quota-definition.service';
import { AdaptiveRateLimitingService } from './adaptive-rate-limiting.service';
import { UserQuotaUsage } from '../entities/user-quota-usage.entity';
import { UserTier } from '../rate-limiting.constants';

const mockLimits = { requestsPerMinute: 5, requestsPerHour: 20, requestsPerDay: 100 };

const makeUsage = (overrides: Partial<UserQuotaUsage> = {}): UserQuotaUsage => ({
  id: 'uuid-1',
  userId: 'user-1',
  tier: UserTier.FREE,
  period: 'MINUTELY',
  count: 0,
  windowStart: new Date(),
  windowEnd: new Date(Date.now() + 60_000),
  isBlocked: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('QuotaTrackingService', () => {
  let service: QuotaTrackingService;
  let repo: jest.Mocked<Repository<UserQuotaUsage>>;

  beforeEach(async () => {
    const repoMock = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      increment: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotaTrackingService,
        { provide: getRepositoryToken(UserQuotaUsage), useValue: repoMock },
        {
          provide: QuotaDefinitionService,
          useValue: { resolveForUser: jest.fn().mockResolvedValue(mockLimits) },
        },
        {
          provide: AdaptiveRateLimitingService,
          useValue: { adjustLimit: (value: number) => value },
        },
      ],
    }).compile();

    service = module.get(QuotaTrackingService);
    repo = module.get(getRepositoryToken(UserQuotaUsage));
  });

  describe('checkAndIncrement', () => {
    it('allows request when under quota', async () => {
      const usage = makeUsage({ count: 2 });
      repo.findOne.mockResolvedValue(usage);
      repo.increment.mockResolvedValue({ affected: 1 } as never);

      const result = await service.checkAndIncrement('user-1', UserTier.FREE);

      expect(result.allowed).toBe(true);
      expect(result.remaining.minute).toBe(2);
      expect(repo.increment).toHaveBeenCalledTimes(3);
    });

    it('blocks request when minute quota is exhausted and marks overage', async () => {
      repo.findOne
        .mockResolvedValueOnce(makeUsage({ id: 'm', count: 5, period: 'MINUTELY' }))
        .mockResolvedValueOnce(makeUsage({ id: 'h', count: 10, period: 'HOURLY' }))
        .mockResolvedValueOnce(makeUsage({ id: 'd', count: 50, period: 'DAILY' }));
      repo.update.mockResolvedValue({ affected: 1 } as never);

      const result = await service.checkAndIncrement('user-1', UserTier.FREE);

      expect(result.allowed).toBe(false);
      expect(result.remaining.minute).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(repo.increment).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalled();
    });

    it('blocks immediately when a window is marked blocked', async () => {
      repo.findOne
        .mockResolvedValueOnce(makeUsage({ isBlocked: true, count: 1 }))
        .mockResolvedValueOnce(makeUsage({ id: 'h', count: 1, period: 'HOURLY' }))
        .mockResolvedValueOnce(makeUsage({ id: 'd', count: 1, period: 'DAILY' }));

      const result = await service.checkAndIncrement('user-1', UserTier.FREE);

      expect(result.allowed).toBe(false);
      expect(repo.increment).not.toHaveBeenCalled();
    });

    it('creates a fresh window when existing window has expired', async () => {
      const expired = makeUsage({ windowEnd: new Date(Date.now() - 1000) });
      repo.findOne.mockResolvedValue(expired);
      repo.delete.mockResolvedValue({ affected: 1 } as never);
      repo.save.mockImplementation(async (entity) => ({ ...entity, id: 'new-uuid' }) as UserQuotaUsage);
      repo.increment.mockResolvedValue({ affected: 1 } as never);

      const result = await service.checkAndIncrement('user-1', UserTier.FREE);

      expect(repo.delete).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(result.allowed).toBe(true);
    });
  });

  describe('resetUser', () => {
    it('deletes all usage rows for a user', async () => {
      repo.delete.mockResolvedValue({ affected: 3 } as never);
      await service.resetUser('user-1');
      expect(repo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    });

    it('deletes only the specified period', async () => {
      repo.delete.mockResolvedValue({ affected: 1 } as never);
      await service.resetUser('user-1', 'DAILY');
      expect(repo.delete).toHaveBeenCalledWith({ userId: 'user-1', period: 'DAILY' });
    });
  });

  describe('getStatus', () => {
    it('returns correct quota status without incrementing', async () => {
      repo.findOne.mockResolvedValue(makeUsage({ count: 3 }));

      const status = await service.getStatus('user-1', UserTier.FREE);

      expect(status.userId).toBe('user-1');
      expect(status.minuteUsed).toBe(3);
      expect(status.minuteLimit).toBe(5);
      expect(repo.increment).not.toHaveBeenCalled();
    });
  });
});
