import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
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

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  // create() merges the provided value so callers get back the same shape
  create: jest.fn((v) => ({ ...v })),
  // save() resolves with exactly the object passed in so the persisted state
  // is what the service assigned BEFORE calling save (Issue #1000).
  save: jest.fn((v) => Promise.resolve({ ...v })),
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

const mockTiersService = () => ({
  getTierForPoints: jest.fn().mockImplementation(realGetTierForPoints),
});

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

describe('PointsService', () => {
  let service: PointsService;
  let progressRepo: ReturnType<typeof mockRepo>;
  let txRepo: ReturnType<typeof mockRepo>;
  let tiersService: ReturnType<typeof mockTiersService>;
  let emitter: { emit: jest.Mock };

  beforeEach(async () => {
    emitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        { provide: getRepositoryToken(UserProgress), useFactory: mockRepo },
        { provide: getRepositoryToken(PointTransaction), useFactory: mockRepo },
        { provide: EventEmitter2, useValue: emitter },
        { provide: TiersService, useFactory: mockTiersService },
      ],
    }).compile();

    service = module.get(PointsService);
    progressRepo = module.get(getRepositoryToken(UserProgress));
    txRepo = module.get(getRepositoryToken(PointTransaction));
    tiersService = module.get(TiersService);
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
    it('uses POINT_RULES for known activity types', async () => {
      progressRepo.findOne.mockResolvedValue(null);
      const { progress } = await service.awardActivity('user-1', PointActivityType.DAILY_LOGIN);
      expect(progress.totalPoints).toBe(10); // DAILY_LOGIN = 10
    });
  });

  // -------------------------------------------------------------------------
  // getUserProgress
  // -------------------------------------------------------------------------

  describe('getUserProgress', () => {
    it('returns null when no progress exists', async () => {
      progressRepo.findOne.mockResolvedValue(null);
      await expect(service.getUserProgress('user-1')).resolves.toBeNull();
    });
  });
});
