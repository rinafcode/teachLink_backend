import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  LeaderboardService,
  MAX_LEADERBOARD_LIMIT,
  LEADERBOARD_CACHE_TTL_SECONDS,
} from './leaderboards.service';
import { UserProgress } from '../entities/user-progress.entity';
import { UserBadge } from '../entities/user-badge.entity';
import { BadgeCategory } from '../enums/badge-category.enum';
import { REDIS_CLIENT } from '../../common/redis/redis.constants';
import { createMockRedisClient } from '../../../test/utils/mock-factories';

/**
 * Builds a chained TypeORM QueryBuilder mock. Every chainable method returns
 * `this` so call order in the service is preserved for assertions on the
 * terminal methods (`take`, `limit`, `getMany`, `getRawMany`).
 */
const createQueryBuilderMock = (overrides: Record<string, jest.Mock> = {}) => ({
  innerJoin: jest.fn().mockReturnThis(),
  innerJoinAndSelect: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  addGroupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  having: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
  getRawMany: jest.fn(),
  getCount: jest.fn(),
  ...overrides,
});

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let progressRepo: { createQueryBuilder: jest.Mock };
  let badgeRepo: { createQueryBuilder: jest.Mock };
  let redis: ReturnType<typeof createMockRedisClient>;

  beforeEach(async () => {
    progressRepo = { createQueryBuilder: jest.fn() };
    badgeRepo = { createQueryBuilder: jest.fn() };
    redis = createMockRedisClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: getRepositoryToken(UserProgress), useValue: progressRepo },
        { provide: getRepositoryToken(UserBadge), useValue: badgeRepo },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(LeaderboardService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getTopPlayers — limit clamp
  // ─────────────────────────────────────────────────────────────────────────

  describe('getTopPlayers — limit clamp (issue #1159)', () => {
    it('uses the default limit of 10 when none is supplied', async () => {
      const qb = createQueryBuilderMock({ getMany: jest.fn().mockResolvedValue([]) });
      progressRepo.createQueryBuilder.mockReturnValue(qb);
      (redis.get as jest.Mock).mockResolvedValue(null);

      await service.getTopPlayers();

      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('clamps an oversized limit to MAX_LEADERBOARD_LIMIT', async () => {
      const qb = createQueryBuilderMock({ getMany: jest.fn().mockResolvedValue([]) });
      progressRepo.createQueryBuilder.mockReturnValue(qb);
      (redis.get as jest.Mock).mockResolvedValue(null);

      await service.getTopPlayers(1000000);

      expect(qb.take).toHaveBeenCalledWith(MAX_LEADERBOARD_LIMIT);
    });

    it('coerces a non-positive limit up to 1', async () => {
      const qb = createQueryBuilderMock({ getMany: jest.fn().mockResolvedValue([]) });
      progressRepo.createQueryBuilder.mockReturnValue(qb);
      (redis.get as jest.Mock).mockResolvedValue(null);

      await service.getTopPlayers(0);

      expect(qb.take).toHaveBeenCalledWith(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getTopPlayers — caching
  // ─────────────────────────────────────────────────────────────────────────

  describe('getTopPlayers — caching (issue #1159)', () => {
    it('serves a cache hit without re-running the sort query', async () => {
      const cached = [
        { rank: 1, userId: 'u1', username: 'alice', totalPoints: 500, level: 2, badgeCount: 1 },
      ];
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cached));

      const result = await service.getTopPlayers(10);

      expect(result).toEqual(cached);
      expect(progressRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('runs the query on a cache miss and caches the result with the leaderboard TTL', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      const qb = createQueryBuilderMock({
        getMany: jest.fn().mockResolvedValue([
          {
            user: { id: 'u1', username: 'alice', email: 'alice@test.com' },
            totalPoints: 500,
            level: 2,
          },
        ]),
      });
      progressRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getTopPlayers(10);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        rank: 1,
        userId: 'u1',
        username: 'alice',
        totalPoints: 500,
      });
      expect(redis.setex).toHaveBeenCalledWith(
        'cache:leaderboard:points:10',
        LEADERBOARD_CACHE_TTL_SECONDS,
        expect.any(String),
      );
    });

    it('uses the clamped limit in the cache key', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      const qb = createQueryBuilderMock({ getMany: jest.fn().mockResolvedValue([]) });
      progressRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getTopPlayers(1000000);

      expect(redis.setex).toHaveBeenCalledWith(
        `cache:leaderboard:points:${MAX_LEADERBOARD_LIMIT}`,
        LEADERBOARD_CACHE_TTL_SECONDS,
        expect.any(String),
      );
    });

    it('falls back to the database when the Redis read fails', async () => {
      (redis.get as jest.Mock).mockRejectedValue(new Error('redis down'));
      const qb = createQueryBuilderMock({
        getMany: jest
          .fn()
          .mockResolvedValue([
            { user: { id: 'u1', username: 'alice' }, totalPoints: 500, level: 2 },
          ]),
      });
      progressRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getTopPlayers(10);

      expect(result).toHaveLength(1);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('works without a Redis client (optional injection)', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LeaderboardService,
          { provide: getRepositoryToken(UserProgress), useValue: progressRepo },
          { provide: getRepositoryToken(UserBadge), useValue: badgeRepo },
        ],
      }).compile();

      const noRedisService = module.get(LeaderboardService);
      const qb = createQueryBuilderMock({
        getMany: jest
          .fn()
          .mockResolvedValue([
            { user: { id: 'u1', username: 'alice' }, totalPoints: 500, level: 2 },
          ]),
      });
      progressRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await noRedisService.getTopPlayers(10);

      expect(result).toHaveLength(1);
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getBadgeLeaderboard — limit clamp and caching
  // ─────────────────────────────────────────────────────────────────────────

  describe('getBadgeLeaderboard — limit clamp (issue #1159)', () => {
    it('clamps an oversized limit to MAX_LEADERBOARD_LIMIT', async () => {
      const qb = createQueryBuilderMock({ getRawMany: jest.fn().mockResolvedValue([]) });
      badgeRepo.createQueryBuilder.mockReturnValue(qb);
      (redis.get as jest.Mock).mockResolvedValue(null);

      await service.getBadgeLeaderboard(5000);

      expect(qb.limit).toHaveBeenCalledWith(MAX_LEADERBOARD_LIMIT);
    });
  });

  describe('getBadgeLeaderboard — caching (issue #1159)', () => {
    it('serves a cache hit without re-running the aggregate query', async () => {
      const cached = [
        {
          rank: 1,
          userId: 'u1',
          username: 'bob',
          badgeCount: 3,
          category: BadgeCategory.ACHIEVEMENT,
          totalPoints: 0,
          level: 0,
          tier: 'BRONZE',
        },
      ];
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cached));

      const result = await service.getBadgeLeaderboard(10, BadgeCategory.ACHIEVEMENT);

      expect(result).toEqual(cached);
      expect(badgeRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('runs the aggregate query on a cache miss and caches the result', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      const qb = createQueryBuilderMock({
        getRawMany: jest
          .fn()
          .mockResolvedValue([
            { userId: 'u1', username: 'bob', email: 'bob@test.com', badgeCount: '3' },
          ]),
      });
      badgeRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getBadgeLeaderboard(10, BadgeCategory.ACHIEVEMENT);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ rank: 1, userId: 'u1', username: 'bob', badgeCount: 3 });
      expect(redis.setex).toHaveBeenCalledWith(
        `cache:leaderboard:badges:${BadgeCategory.ACHIEVEMENT}:10`,
        LEADERBOARD_CACHE_TTL_SECONDS,
        expect.any(String),
      );
    });

    it('uses the clamped limit in the badge cache key', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      const qb = createQueryBuilderMock({ getRawMany: jest.fn().mockResolvedValue([]) });
      badgeRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getBadgeLeaderboard(9999);

      expect(redis.setex).toHaveBeenCalledWith(
        `cache:leaderboard:badges:all:${MAX_LEADERBOARD_LIMIT}`,
        LEADERBOARD_CACHE_TTL_SECONDS,
        expect.any(String),
      );
    });

    it('filters by category on a cache miss', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      const qb = createQueryBuilderMock({ getRawMany: jest.fn().mockResolvedValue([]) });
      badgeRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getBadgeLeaderboard(10, BadgeCategory.SOCIAL);

      expect(qb.andWhere).toHaveBeenCalledWith('badge.category = :category', {
        category: BadgeCategory.SOCIAL,
      });
    });
  });
});
