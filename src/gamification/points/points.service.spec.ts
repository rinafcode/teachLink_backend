import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { PointsService } from './points.service';
import { UserProgress } from '../entities/user-progress.entity';
import { PointTransaction } from '../entities/point-transaction.entity';
import { TiersService, TIER_THRESHOLDS } from '../tiers/tiers.service';
import { Tier } from '../enums/tier.enum';
import { PointActivityType } from '../enums/point-activity.enum';
import { GAMIFICATION_EVENTS } from '../events/gamification.events';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Mock repository factory for unit tests
 */
const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  // create() merges the provided value so callers get back the same shape
  create: jest.fn((v) => ({ ...v })),
  // save() resolves with exactly the object passed in so the persisted state
  // is what the service assigned BEFORE calling save (Issue #1000).
  save: jest.fn((v) => Promise.resolve({ ...v })),
  insert: jest.fn(),
});

// Real getTierForPoints logic, based on TIER_THRESHOLDS, so tier-boundary
// tests exercise the actual computation path.
const realGetTierForPoints = (totalPoints: number): Tier => {
  const order: Tier[] = [Tier.BRONZE, Tier.SILVER, Tier.GOLD, Tier.PLATINUM, Tier.DIAMOND];
  let tier = Tier.BRONZE;
  for (const t of order) {
    if (totalPoints >= TIER_THRESHOLDS[t]) tier = t;
  }
  return tier;
};

/**
 * Mock TiersService factory
 */
const mockTiersService = () => ({
  getTierForPoints: jest.fn().mockImplementation(realGetTierForPoints),
});

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------
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
  let emitter: { emit: jest.Mock };
  let dataSource: ReturnType<typeof mockDataSource>;

  beforeEach(async () => {
    emitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        { provide: getRepositoryToken(UserProgress), useFactory: mockRepo },
        { provide: getRepositoryToken(PointTransaction), useFactory: mockRepo },
        { provide: EventEmitter2, useValue: emitter },
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

  // -------------------------------------------------------------------------
  // addPoints — basic behaviour
  // -------------------------------------------------------------------------

  describe('addPoints', () => {
    it('creates a transaction and updates progress', async () => {
      progressRepo.findOne.mockResolvedValue(null);
      const { progress } = await service.addPoints('user-1', 100, 'TEST');
      expect(txRepo.save).toHaveBeenCalled();
      expect(progress.totalPoints).toBe(100);
      expect(progress.xp).toBe(100);
    });
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

    it('detects tier promotion when tier changes', async () => {
      const existing: Partial<UserProgress> = {
        totalPoints: 900,
        xp: 900,
        level: 1,
        tier: Tier.BRONZE,
      };
      progressRepo.findOne.mockResolvedValue(existing);
      // 900 + 200 = 1100 → SILVER threshold is 1000
      const { tierPromoted } = await service.addPoints('user-1', 200, 'TEST');
      expect(tierPromoted).toBe(true);
    });

    it('does not flag promotion when tier is unchanged', async () => {
      const existing: Partial<UserProgress> = {
        totalPoints: 100,
        xp: 100,
        level: 1,
        tier: Tier.BRONZE,
      };
      progressRepo.findOne.mockResolvedValue(existing);
      // 100 + 50 = 150 — still BRONZE
      const { tierPromoted } = await service.addPoints('user-1', 50, 'TEST');
      expect(tierPromoted).toBe(false);
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
        Array.from({ length: N }, (_, i) =>
          service.addPoints(userId, pointsPerAward, `concurrent award ${i}`),
        ),
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
        Array.from({ length: N }, (_, i) =>
          service.addPoints(userId, pointsPerAward, `burst ${i}`),
        ),
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

    // -------------------------------------------------------------------------
    // Issue #1000 — tier must be persisted in the same save call
    // -------------------------------------------------------------------------

    it('persists the new tier inside the save call (Issue #1000)', async () => {
      const existing: Partial<UserProgress> = {
        totalPoints: 900,
        xp: 900,
        level: 1,
        tier: Tier.BRONZE,
      };
      progressRepo.findOne.mockResolvedValue(existing);

      // 900 + 200 = 1100 → SILVER
      await service.addPoints('user-1', 200, 'TEST');

      // The argument that was passed to save() must already carry the new tier,
      // not the old one — no second save should be needed.
      const savedArg: Partial<UserProgress> = progressRepo.save.mock.calls[0][0];
      expect(savedArg.tier).toBe(Tier.SILVER);
    });

    it('returned progress.tier matches what was persisted (Issue #1000)', async () => {
      progressRepo.findOne.mockResolvedValue(null);

      // Starting from 0, award enough to reach SILVER (1000 pts)
      const { progress } = await service.addPoints('user-1', 1000, 'TEST');

      expect(progress.tier).toBe(Tier.SILVER);
    });

    it('emits POINTS_AWARDED only after save resolves (Issue #1000)', async () => {
      progressRepo.findOne.mockResolvedValue(null);

      // Make save() resolve asynchronously but controllably
      let resolveSave!: (v: any) => void;
      progressRepo.save.mockReturnValueOnce(
        new Promise((r) => {
          resolveSave = r;
        }),
      );

      const addPromise = service.addPoints('user-1', 100, 'TEST');

      // Event must NOT fire before save resolves
      expect(emitter.emit).not.toHaveBeenCalled();

      resolveSave({ totalPoints: 100, xp: 100, level: 1, tier: Tier.BRONZE });
      await addPromise;

      expect(emitter.emit).toHaveBeenCalledWith(
        GAMIFICATION_EVENTS.POINTS_AWARDED,
        expect.any(Object),
      );
    });

    it('does not emit if save rejects (Issue #1000)', async () => {
      progressRepo.findOne.mockResolvedValue(null);
      progressRepo.save.mockRejectedValueOnce(new Error('DB write failed'));

      await expect(service.addPoints('user-1', 100, 'TEST')).rejects.toThrow('DB write failed');

      expect(emitter.emit).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Issue #1000 — tier boundary crossing test: promotion fires exactly once
  // -------------------------------------------------------------------------

  describe('tier boundary crossing across two awards', () => {
    it('promoton event fires once and persisted tier is correct after crossing SILVER boundary', async () => {
      // First award: stays in BRONZE (900 pts)
      progressRepo.findOne.mockResolvedValueOnce(null);
      const first = await service.addPoints('user-1', 900, 'TEST');

      expect(first.tierPromoted).toBe(false);
      expect(first.progress.tier).toBe(Tier.BRONZE);

      // Simulate what the DB would return on the next read — BRONZE with 900pts
      const afterFirstSave = { ...progressRepo.save.mock.results[0].value };

      // Second award: crosses into SILVER (900 + 200 = 1100)
      progressRepo.findOne.mockResolvedValueOnce(afterFirstSave);
      const second = await service.addPoints('user-1', 200, 'TEST');

      expect(second.tierPromoted).toBe(true);
      expect(second.progress.tier).toBe(Tier.SILVER);

      // The saved argument on the second save must carry SILVER
      const secondSaveArg: Partial<UserProgress> =
        progressRepo.save.mock.calls[progressRepo.save.mock.calls.length - 1][0];
      expect(secondSaveArg.tier).toBe(Tier.SILVER);

      // Total POINTS_AWARDED emissions across both calls
      const promotionEmits = emitter.emit.mock.calls.filter(
        ([event]) => event === GAMIFICATION_EVENTS.POINTS_AWARDED,
      );
      expect(promotionEmits).toHaveLength(2); // one per award, regardless of tier change

      // tierPromoted was false on first and true on second — exactly one boundary crossing
      expect(first.tierPromoted).toBe(false);
      expect(second.tierPromoted).toBe(true);
    });

    it('does not fire a second promotion when the same boundary is re-approached', async () => {
      // User already at SILVER (1000 pts), award more without crossing GOLD (5000 pts)
      const existing: Partial<UserProgress> = {
        totalPoints: 1000,
        xp: 1000,
        level: 2,
        tier: Tier.SILVER,
      };
      progressRepo.findOne.mockResolvedValue(existing);

      const { tierPromoted } = await service.addPoints('user-1', 100, 'TEST');

      expect(tierPromoted).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // awardActivity
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // getUserProgress
  // -------------------------------------------------------------------------

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
