import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuotaTrackingService } from '../../src/rate-limiting/services/quota-tracking.service';
import { QuotaDefinitionService } from '../../src/rate-limiting/services/quota-definition.service';
import { UserQuotaUsage } from '../../src/rate-limiting/entities/user-quota-usage.entity';
import { UserTier } from '../../src/rate-limiting/rate-limiting.constants';

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
  let definitionService: jest.Mocked<QuotaDefinitionService>;

  beforeEach(async () => {
    const repoMock = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      increment: jest.fn(),
    };

    const defMock = {
      resolveForUser: jest.fn().mockResolvedValue(mockLimits),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotaTrackingService,
        { provide: getRepositoryToken(UserQuotaUsage), useValue: repoMock },
        { provide: QuotaDefinitionService, useValue: defMock },
      ],
    }).compile();

    service = module.get(QuotaTrackingService);
    repo = module.get(getRepositoryToken(UserQuotaUsage));
    definitionService = module.get(QuotaDefinitionService);
  });

  describe('checkAndIncrement', () => {
    it('allows request when under quota', async () => {
      const usage = makeUsage({ count: 2 });
      repo.findOne.mockResolvedValue(usage);
      repo.increment.mockResolvedValue({ affected: 1 } as any);

      const result = await service.checkAndIncrement('user-1', UserTier.FREE);

      expect(result.allowed).toBe(true);
      expect(result.remaining.minute).toBe(2); // 5 - 2 - 1 = 2
      expect(repo.increment).toHaveBeenCalledTimes(3); // minute + hour + day
    });

    it('blocks request when minute quota is exhausted', async () => {
      // minute exhausted, hour/day fine
      repo.findOne
        .mockResolvedValueOnce(makeUsage({ count: 5, period: 'MINUTELY' }))   // minute
        .mockResolvedValueOnce(makeUsage({ count: 10, period: 'HOURLY' }))    // hour
        .mockResolvedValueOnce(makeUsage({ count: 50, period: 'DAILY' }));    // day

      const result = await service.checkAndIncrement('user-1', UserTier.FREE);

      expect(result.allowed).toBe(false);
      expect(result.remaining.minute).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(repo.increment).not.toHaveBeenCalled();
    });

    it('creates a fresh window when existing window has expired', async () => {
      const expired = makeUsage({ windowEnd: new Date(Date.now() - 1000) });
      repo.findOne.mockResolvedValue(expired);
      repo.delete.mockResolvedValue({ affected: 1 } as any);
      repo.save.mockImplementation(async (e) => ({ ...e, id: 'new-uuid' } as any));
      repo.increment.mockResolvedValue({ affected: 1 } as any);

      const result = await service.checkAndIncrement('user-1', UserTier.FREE);

      expect(repo.delete).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(result.allowed).toBe(true);
    });
  });

  describe('resetUser', () => {
    it('deletes all usage rows for a user', async () => {
      repo.delete.mockResolvedValue({ affected: 3 } as any);
      await service.resetUser('user-1');
      expect(repo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    });

    it('deletes only the specified period', async () => {
      repo.delete.mockResolvedValue({ affected: 1 } as any);
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
