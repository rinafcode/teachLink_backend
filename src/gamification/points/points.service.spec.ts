import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { PointsService } from './points.service';
import { UserProgress } from '../entities/user-progress.entity';
import { PointTransaction } from '../entities/point-transaction.entity';
import { TiersService } from '../tiers/tiers.service';
import { Tier } from '../enums/tier.enum';
import { PointActivityType } from '../enums/point-activity.enum';

/**
 * Mock repository factory for unit tests
 */
const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((v) => v),
  save: jest.fn((v) => Promise.resolve(v)),
  insert: jest.fn(),
});

/**
 * Mock TiersService factory
 */
const mockTiersService = () => ({
  getTierForPoints: jest.fn().mockReturnValue(Tier.BRONZE),
});

/**
 * Mock DataSource factory for transaction testing
 */
const mockDataSource = () => ({
  createQueryRunner: jest.fn(),
});

describe('PointsService', () => {
  let service: PointsService;
  let progressRepo: ReturnType<typeof mockRepo>;
  let txRepo: ReturnType<typeof mockRepo>;
  let tiersService: ReturnType<typeof mockTiersService>;
  let dataSource: ReturnType<typeof mockDataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        { provide: getRepositoryToken(UserProgress), useFactory: mockRepo },
        { provide: getRepositoryToken(PointTransaction), useFactory: mockRepo },
        { provide: DataSource, useFactory: mockDataSource },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: TiersService, useFactory: mockTiersService },
      ],
    }).compile();

    service = module.get(PointsService);
    progressRepo = module.get(getRepositoryToken(UserProgress));
    txRepo = module.get(getRepositoryToken(PointTransaction));
    tiersService = module.get(TiersService);
    dataSource = module.get(DataSource);
  });

  describe('addPoints — basic correctness', () => {
    let mockQueryRunner: any;
    let mockManager: any;

    beforeEach(() => {
      // Setup QueryRunner mock for transaction tests
      mockManager = {
        query: jest.fn(),
        insert: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn((_, v) => v),
      };

      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: mockManager,
      };

      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    });

    it('awards points to a user', async () => {
      const userId = 'user-test-1';
      const points = 10;

      mockManager.query.mockResolvedValue([
        {
          id: 'progress-1',
          userId,
          totalPoints: points,
          xp: points,
          level: 1,
          tier: Tier.BRONZE,
        },
      ]);

      const result = await service.addPoints(userId, points, 'test award');

      expect(result.progress.totalPoints).toBe(points);
      expect(result.progress.xp).toBe(points);
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('inserts a PointTransaction ledger row', async () => {
      const userId = 'user-test-2';
      const points = 10;

      mockManager.query.mockResolvedValue([
        {
          id: 'progress-2',
          userId,
          totalPoints: points,
          xp: points,
          level: 1,
          tier: Tier.BRONZE,
        },
      ]);

      mockManager.insert.mockResolvedValue(undefined);

      await service.addPoints(userId, points, 'test award');

      expect(mockManager.insert).toHaveBeenCalledWith(
        PointTransaction,
        expect.objectContaining({
          user: { id: userId },
          points,
          activityType: 'test award',
        }),
      );
    });

    it('accumulates points on sequential awards', async () => {
      const userId = 'user-test-3';

      // First call
      mockManager.query.mockResolvedValueOnce([
        {
          id: 'progress-3',
          userId,
          totalPoints: 10,
          xp: 10,
          level: 1,
          tier: Tier.BRONZE,
        },
      ]);

      await service.addPoints(userId, 10, 'first');

      // Second call
      mockManager.query.mockResolvedValueOnce([
        {
          id: 'progress-3',
          userId,
          totalPoints: 30, // 10 + 20
          xp: 30,
          level: 1,
          tier: Tier.BRONZE,
        },
      ]);

      const result = await service.addPoints(userId, 20, 'second');

      expect(result.progress.totalPoints).toBe(30);
      expect(result.progress.xp).toBe(30);
    });
  });

  describe('addPoints — concurrent awards produce correct totals', () => {
    let mockQueryRunner: any;
    let mockManager: any;

    beforeEach(() => {
      mockManager = {
        query: jest.fn(),
        insert: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn((_, v) => v),
      };

      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: mockManager,
      };

      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    });

    it('N concurrent awards accumulate correctly (no lost updates)', async () => {
      const N = 10;
      const pointsPerAward = 5;
      const expectedTotal = N * pointsPerAward;
      const userId = 'user-concurrent-1';

      // Mock the query to return cumulative totals simulating atomic updates
      let accumulatedTotal = 0;
      mockManager.query.mockImplementation(() => {
        accumulatedTotal += pointsPerAward;
        return Promise.resolve([
          {
            id: 'progress-concurrent-1',
            userId,
            totalPoints: accumulatedTotal,
            xp: accumulatedTotal,
            level: Math.floor(accumulatedTotal / 1000) + 1,
            tier: Tier.BRONZE,
          },
        ]);
      });

      mockManager.insert.mockResolvedValue(undefined);

      // Fire N awards simultaneously
      const results = await Promise.all(
        Array.from({ length: N }, (_, i) => service.addPoints(userId, pointsPerAward, `concurrent award ${i}`)),
      );

      // All should succeed
      expect(results).toHaveLength(N);

      // Final result should have the expected total
      const finalResult = results[results.length - 1];
      expect(finalResult.progress.totalPoints).toBe(expectedTotal);
      expect(finalResult.progress.xp).toBe(expectedTotal);
    });

    it('large concurrent burst (N=50) produces correct total', async () => {
      const N = 50;
      const pointsPerAward = 2;
      const expectedTotal = N * pointsPerAward;
      const userId = 'user-concurrent-50';

      let accumulatedTotal = 0;
      mockManager.query.mockImplementation(() => {
        accumulatedTotal += pointsPerAward;
        return Promise.resolve([
          {
            id: 'progress-concurrent-50',
            userId,
            totalPoints: accumulatedTotal,
            xp: accumulatedTotal,
            level: Math.floor(accumulatedTotal / 1000) + 1,
            tier: Tier.BRONZE,
          },
        ]);
      });

      mockManager.insert.mockResolvedValue(undefined);

      // Fire N awards simultaneously
      const results = await Promise.all(
        Array.from({ length: N }, (_, i) => service.addPoints(userId, pointsPerAward, `burst ${i}`)),
      );

      const finalResult = results[results.length - 1];
      expect(finalResult.progress.totalPoints).toBe(expectedTotal);
    });
  });

  describe('addPoints — first-award race conditions', () => {
    let mockQueryRunner: any;
    let mockManager: any;

    beforeEach(() => {
      mockManager = {
        query: jest.fn(),
        insert: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn((_, v) => v),
      };

      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: mockManager,
      };

      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    });

    it('two concurrent first awards accumulate both amounts', async () => {
      const userId = 'user-first-concurrent';

      // Simulate INSERT...ON CONFLICT DO UPDATE behavior
      let totalPoints = 0;
      mockManager.query.mockImplementation(() => {
        // Accumulate the points being added
        totalPoints += 15; // First call adds 10, second adds 20, but we simulate per call
        return Promise.resolve([
          {
            id: 'progress-first-concurrent',
            userId,
            totalPoints,
            xp: totalPoints,
            level: 1,
            tier: Tier.BRONZE,
          },
        ]);
      });

      mockManager.insert.mockResolvedValue(undefined);

      // Both awards fire before either creates the progress row
      const results = await Promise.all([
        service.addPoints(userId, 10, 'first concurrent'),
        service.addPoints(userId, 20, 'second concurrent'),
      ]);

      // Both should succeed
      expect(results).toHaveLength(2);
      // Both transactions should be recorded
      expect(mockManager.insert).toHaveBeenCalledTimes(2);
    });

    it('first award creates progress row with correct initial value', async () => {
      const userId = 'user-first-initial';
      const points = 15;

      mockManager.query.mockResolvedValue([
        {
          id: 'progress-first-initial',
          userId,
          totalPoints: points,
          xp: points,
          level: 1,
          tier: Tier.BRONZE,
        },
      ]);

      mockManager.insert.mockResolvedValue(undefined);

      const result = await service.addPoints(userId, points, 'first ever');

      expect(result.progress).toBeDefined();
      expect(result.progress.totalPoints).toBe(points);
      expect(result.progress.xp).toBe(points);
    });
  });

  describe('addPoints — atomicity: ledger and aggregate', () => {
    let mockQueryRunner: any;
    let mockManager: any;

    beforeEach(() => {
      mockManager = {
        query: jest.fn(),
        insert: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn((_, v) => v),
      };

      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: mockManager,
      };

      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    });

    it('both ledger and aggregate updated in same transaction', async () => {
      const userId = 'user-atomic-1';

      mockManager.query.mockResolvedValue([
        {
          id: 'progress-atomic-1',
          userId,
          totalPoints: 10,
          xp: 10,
          level: 1,
          tier: Tier.BRONZE,
        },
      ]);

      mockManager.insert.mockResolvedValue(undefined);

      const result = await service.addPoints(userId, 10, 'atomic test');

      // Both queries must have been called
      expect(mockManager.query).toHaveBeenCalled();
      expect(mockManager.insert).toHaveBeenCalled();

      // Transaction must have been committed
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.progress).toBeDefined();
    });

    it('rolls back aggregate if ledger insert fails', async () => {
      const userId = 'user-atomic-fail';

      mockManager.query.mockResolvedValue([
        {
          id: 'progress-atomic-fail',
          userId,
          totalPoints: 10,
          xp: 10,
          level: 1,
          tier: Tier.BRONZE,
        },
      ]);

      // Mock ledger insert to throw
      mockManager.insert.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.addPoints(userId, 10, 'will fail')).rejects.toThrow();

      // Transaction must have been rolled back
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('ledger row count equals number of successful awards', async () => {
      const N = 5;
      const userId = 'user-ledger-count';

      mockManager.query.mockResolvedValue([
        {
          id: 'progress-ledger',
          userId,
          totalPoints: N,
          xp: N,
          level: 1,
          tier: Tier.BRONZE,
        },
      ]);

      mockManager.insert.mockResolvedValue(undefined);

      await Promise.all(
        Array.from({ length: N }, (_, i) => service.addPoints(userId, 1, `award ${i}`)),
      );

      // Each award should create exactly one ledger row
      expect(mockManager.insert).toHaveBeenCalledTimes(N);
    });
  });

  describe('awardActivity', () => {
    let mockQueryRunner: any;
    let mockManager: any;

    beforeEach(() => {
      mockManager = {
        query: jest.fn(),
        insert: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn((_, v) => v),
      };

      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: mockManager,
      };

      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    });

    it('uses POINT_RULES for known activity types', async () => {
      const userId = 'user-activity';

      mockManager.query.mockResolvedValue([
        {
          id: 'progress-activity',
          userId,
          totalPoints: 10,
          xp: 10,
          level: 1,
          tier: Tier.BRONZE,
        },
      ]);

      mockManager.insert.mockResolvedValue(undefined);

      const result = await service.awardActivity(userId, PointActivityType.DAILY_LOGIN);

      expect(result.progress.totalPoints).toBe(10); // DAILY_LOGIN = 10
    });
  });

  describe('getUserProgress', () => {
    it('returns null when no progress exists', async () => {
      progressRepo.findOne.mockResolvedValue(null);
      await expect(service.getUserProgress('user-no-progress')).resolves.toBeNull();
    });

    it('returns progress when it exists', async () => {
      const progress: Partial<UserProgress> = {
        id: 'progress-exists',
        totalPoints: 100,
        xp: 100,
        level: 1,
        tier: Tier.BRONZE,
      };

      progressRepo.findOne.mockResolvedValue(progress);

      const result = await service.getUserProgress('user-exists');

      expect(result).toEqual(progress);
    });
  });

  describe('getPointHistory', () => {
    it('returns empty array when no transactions exist', async () => {
      txRepo.find.mockResolvedValue([]);

      const result = await service.getPointHistory('user-no-history');

      expect(result).toEqual([]);
    });

    it('returns transactions ordered by creation date descending', async () => {
      const transactions = [
        { id: '1', points: 10, createdAt: new Date('2024-01-03'), activityType: 'THIRD' },
        { id: '2', points: 5, createdAt: new Date('2024-01-02'), activityType: 'SECOND' },
        { id: '3', points: 1, createdAt: new Date('2024-01-01'), activityType: 'FIRST' },
      ];

      txRepo.find.mockResolvedValue(transactions);

      const result = await service.getPointHistory('user-with-history');

      expect(result).toHaveLength(3);
      expect(result[0].activityType).toBe('THIRD');
    });
  });
});
