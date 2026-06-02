import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PointsService } from './points.service';
import { UserProgress } from '../entities/user-progress.entity';
import { PointTransaction } from '../entities/point-transaction.entity';
import { TiersService } from '../tiers/tiers.service';
import { Tier } from '../enums/tier.enum';
import { PointActivityType } from '../enums/point-activity.enum';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((v) => v),
  save: jest.fn((v) => Promise.resolve(v)),
});

const mockTiersService = () => ({
  getTierForPoints: jest.fn().mockReturnValue(Tier.BRONZE),
});

describe('PointsService', () => {
  let service: PointsService;
  let progressRepo: ReturnType<typeof mockRepo>;
  let txRepo: ReturnType<typeof mockRepo>;
  let tiersService: ReturnType<typeof mockTiersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        { provide: getRepositoryToken(UserProgress), useFactory: mockRepo },
        { provide: getRepositoryToken(PointTransaction), useFactory: mockRepo },
        { provide: TiersService, useFactory: mockTiersService },
      ],
    }).compile();

    service = module.get(PointsService);
    progressRepo = module.get(getRepositoryToken(UserProgress));
    txRepo = module.get(getRepositoryToken(PointTransaction));
    tiersService = module.get(TiersService);
  });

  describe('addPoints', () => {
    it('creates a transaction and updates progress', async () => {
      progressRepo.findOne.mockResolvedValue(null);
      const { progress } = await service.addPoints('user-1', 100, 'TEST');
      expect(txRepo.save).toHaveBeenCalled();
      expect(progress.totalPoints).toBe(100);
      expect(progress.xp).toBe(100);
    });

    it('accumulates points on existing progress', async () => {
      const existing: Partial<UserProgress> = {
        totalPoints: 900,
        xp: 900,
        level: 1,
        tier: Tier.BRONZE,
      };
      progressRepo.findOne.mockResolvedValue(existing);
      const { progress } = await service.addPoints('user-1', 200, 'TEST');
      expect(progress.totalPoints).toBe(1100);
    });

    it('levels up when xp crosses threshold', async () => {
      const existing: Partial<UserProgress> = {
        totalPoints: 900,
        xp: 900,
        level: 1,
        tier: Tier.BRONZE,
      };
      progressRepo.findOne.mockResolvedValue(existing);
      const { progress } = await service.addPoints('user-1', 200, 'TEST');
      expect(progress.level).toBe(2); // floor(1100/1000)+1 = 2
    });

    it('detects tier promotion', async () => {
      const existing: Partial<UserProgress> = {
        totalPoints: 900,
        xp: 900,
        level: 1,
        tier: Tier.BRONZE,
      };
      progressRepo.findOne.mockResolvedValue(existing);
      tiersService.getTierForPoints.mockReturnValue(Tier.SILVER);
      const { tierPromoted } = await service.addPoints('user-1', 200, 'TEST');
      expect(tierPromoted).toBe(true);
    });

    it('does not flag promotion when tier unchanged', async () => {
      const existing: Partial<UserProgress> = {
        totalPoints: 100,
        xp: 100,
        level: 1,
        tier: Tier.BRONZE,
      };
      progressRepo.findOne.mockResolvedValue(existing);
      tiersService.getTierForPoints.mockReturnValue(Tier.BRONZE);
      const { tierPromoted } = await service.addPoints('user-1', 50, 'TEST');
      expect(tierPromoted).toBe(false);
    });
  });

  describe('awardActivity', () => {
    it('uses POINT_RULES for known activity types', async () => {
      progressRepo.findOne.mockResolvedValue(null);
      const { progress } = await service.awardActivity('user-1', PointActivityType.DAILY_LOGIN);
      expect(progress.totalPoints).toBe(10); // DAILY_LOGIN = 10
    });
  });

  describe('getUserProgress', () => {
    it('returns null when no progress exists', async () => {
      progressRepo.findOne.mockResolvedValue(null);
      await expect(service.getUserProgress('user-1')).resolves.toBeNull();
    });
  });
});
