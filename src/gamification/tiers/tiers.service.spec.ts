import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TiersService, TIER_THRESHOLDS } from './tiers.service';
import { TierReward } from '../entities/tier-reward.entity';
import { Tier } from '../enums/tier.enum';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

describe('TiersService', () => {
  let service: TiersService;
  let repo: jest.Mocked<Repository<TierReward>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TiersService, { provide: getRepositoryToken(TierReward), useFactory: mockRepo }],
    }).compile();

    service = module.get(TiersService);
    repo = module.get(getRepositoryToken(TierReward));
  });

  describe('getTierForPoints', () => {
    it.each([
      [0, Tier.BRONZE],
      [999, Tier.BRONZE],
      [1000, Tier.SILVER],
      [4999, Tier.SILVER],
      [5000, Tier.GOLD],
      [14999, Tier.GOLD],
      [15000, Tier.PLATINUM],
      [49999, Tier.PLATINUM],
      [50000, Tier.DIAMOND],
      [999999, Tier.DIAMOND],
    ])('returns %s tier for %i points', (points, expected) => {
      expect(service.getTierForPoints(points)).toBe(expected);
    });
  });

  describe('getNextTier', () => {
    it('returns SILVER for BRONZE', () =>
      expect(service.getNextTier(Tier.BRONZE)).toBe(Tier.SILVER));
    it('returns GOLD for SILVER', () => expect(service.getNextTier(Tier.SILVER)).toBe(Tier.GOLD));
    it('returns null for DIAMOND', () => expect(service.getNextTier(Tier.DIAMOND)).toBeNull());
  });

  describe('pointsToNextTier', () => {
    it('returns correct gap to next tier', () => {
      expect(service.pointsToNextTier(500)).toBe(TIER_THRESHOLDS[Tier.SILVER] - 500);
    });
    it('returns null at max tier', () => {
      expect(service.pointsToNextTier(50000)).toBeNull();
    });
  });

  describe('getRewardForTier', () => {
    it('delegates to repository', async () => {
      const reward = { tier: Tier.GOLD } as TierReward;
      repo.findOne.mockResolvedValue(reward);
      await expect(service.getRewardForTier(Tier.GOLD)).resolves.toBe(reward);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { tier: Tier.GOLD } });
    });
  });

  describe('upsertReward', () => {
    it('updates existing reward', async () => {
      const existing = { tier: Tier.SILVER, title: 'old' } as TierReward;
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockResolvedValue({ ...existing, title: 'new' } as TierReward);
      const result = await service.upsertReward(Tier.SILVER, { title: 'new' });
      expect(result.title).toBe('new');
    });

    it('creates new reward when none exists', async () => {
      repo.findOne.mockResolvedValue(null);
      const created = { tier: Tier.GOLD, title: 'Gold Reward' } as TierReward;
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);
      const result = await service.upsertReward(Tier.GOLD, { title: 'Gold Reward' });
      expect(repo.create).toHaveBeenCalled();
      expect(result).toBe(created);
    });
  });
});
