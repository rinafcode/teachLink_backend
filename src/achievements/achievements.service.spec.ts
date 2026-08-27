import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AchievementsService } from './achievements.service';
import { Achievement, AchievementType, AchievementDifficulty } from './entities/achievement.entity';
import { AchievementProgress } from './entities/achievement-progress.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { AchievementStatistics } from './entities/achievement-statistics.entity';
import { User } from '../users/entities/user.entity';

const mockUser = { id: 'user-1' } as User;

const mockAchievement: Achievement = {
  id: 'ach-1',
  name: 'First Steps',
  description: 'desc',
  longDescription: 'long desc',
  iconUrl: 'https://example.com/icon.png',
  type: AchievementType.MILESTONE,
  difficulty: AchievementDifficulty.EASY,
  pointsReward: 100,
  experienceReward: 50,
  criteria: {},
  progressConfig: { maxProgress: 10 },
  isActive: true,
  isHidden: false,
  unlockedBy: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Achievement;

const mockUserAchievement: UserAchievement = {
  id: 'ua-1',
  user: mockUser,
  achievement: mockAchievement,
  unlockedAt: new Date(),
  pointsEarned: 100,
  experienceEarned: 50,
  notificationSent: false,
  isHidden: false,
  createdAt: new Date(),
  updatedAt: new Date(),
} as UserAchievement;

const mockProgress: AchievementProgress = {
  id: 'prog-1',
  user: mockUser,
  achievement: mockAchievement,
  currentProgress: 0,
  targetProgress: 10,
  percentageComplete: 0,
  isUnlocked: false,
  lastProgressUpdate: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
} as AchievementProgress;

// Build a mock transaction that immediately invokes the callback with repo mocks
const buildMockManager = (
  achRepo: any,
  progressRepo: any,
  userAchRepo: any,
) => ({
  getRepository: (entity: any) => {
    if (entity === Achievement) return achRepo;
    if (entity === AchievementProgress) return progressRepo;
    if (entity === UserAchievement) return userAchRepo;
    return {};
  },
});

describe('AchievementsService', () => {
  let service: AchievementsService;
  let achievementRepo: any;
  let progressRepo: any;
  let userAchievementRepo: any;
  let statisticsRepo: any;
  let cacheManager: any;
  let dataSource: any;

  beforeEach(async () => {
    achievementRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
      increment: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    progressRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    userAchievementRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    statisticsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    cacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      transaction: jest.fn().mockImplementation((cb: (manager: any) => any) =>
        cb(buildMockManager(achievementRepo, progressRepo, userAchievementRepo)),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementsService,
        { provide: getRepositoryToken(Achievement), useValue: achievementRepo },
        { provide: getRepositoryToken(AchievementProgress), useValue: progressRepo },
        { provide: getRepositoryToken(UserAchievement), useValue: userAchievementRepo },
        { provide: getRepositoryToken(AchievementStatistics), useValue: statisticsRepo },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: 'DataSource', useValue: dataSource },
      ],
    }).compile();

    service = module.get<AchievementsService>(AchievementsService);
  });

  // ── createAchievement ────────────────────────────────────────────────────

  describe('createAchievement', () => {
    it('saves and returns the new achievement dto', async () => {
      achievementRepo.create.mockReturnValue(mockAchievement);
      achievementRepo.save.mockResolvedValue(mockAchievement);

      const result = await service.createAchievement({
        name: 'First Steps',
        description: 'desc',
        type: AchievementType.MILESTONE,
        difficulty: AchievementDifficulty.EASY,
        pointsReward: 100,
        experienceReward: 50,
        criteria: {},
      } as any);

      expect(achievementRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(mockAchievement.id);
      expect(cacheManager.del).toHaveBeenCalled();
    });
  });

  // ── getAchievementById ───────────────────────────────────────────────────

  describe('getAchievementById', () => {
    it('returns the achievement when found', async () => {
      achievementRepo.findOne.mockResolvedValue(mockAchievement);

      const result = await service.getAchievementById('ach-1');

      expect(result.id).toBe('ach-1');
    });

    it('throws NotFoundException when achievement does not exist', async () => {
      achievementRepo.findOne.mockResolvedValue(null);

      await expect(service.getAchievementById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateAchievement ────────────────────────────────────────────────────

  describe('updateAchievement', () => {
    it('updates and returns the dto', async () => {
      const updated = { ...mockAchievement, name: 'Updated' };
      achievementRepo.findOne.mockResolvedValue({ ...mockAchievement });
      achievementRepo.save.mockResolvedValue(updated);

      const result = await service.updateAchievement('ach-1', { name: 'Updated' } as any);

      expect(result.name).toBe('Updated');
      expect(cacheManager.del).toHaveBeenCalled();
    });

    it('throws NotFoundException when achievement not found', async () => {
      achievementRepo.findOne.mockResolvedValue(null);

      await expect(service.updateAchievement('missing', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── deactivateAchievement ────────────────────────────────────────────────

  describe('deactivateAchievement', () => {
    it('calls update with isActive false', async () => {
      achievementRepo.update.mockResolvedValue({ affected: 1 });

      await service.deactivateAchievement('ach-1');

      expect(achievementRepo.update).toHaveBeenCalledWith({ id: 'ach-1' }, { isActive: false });
      expect(cacheManager.del).toHaveBeenCalled();
    });
  });

  // ── hasAchievement ───────────────────────────────────────────────────────

  describe('hasAchievement', () => {
    it('returns true when unlock record exists', async () => {
      userAchievementRepo.findOne.mockResolvedValue(mockUserAchievement);

      expect(await service.hasAchievement('user-1', 'ach-1')).toBe(true);
    });

    it('returns false when unlock record is absent', async () => {
      userAchievementRepo.findOne.mockResolvedValue(null);

      expect(await service.hasAchievement('user-1', 'missing')).toBe(false);
    });
  });

  // ── getUserAchievementCount ──────────────────────────────────────────────

  describe('getUserAchievementCount', () => {
    it('returns the count from the repository', async () => {
      userAchievementRepo.count.mockResolvedValue(3);

      expect(await service.getUserAchievementCount('user-1')).toBe(3);
    });
  });

  // ── unlockAchievement ────────────────────────────────────────────────────

  describe('unlockAchievement', () => {
    it('creates and returns an unlock event', async () => {
      userAchievementRepo.findOne.mockResolvedValue(null);
      achievementRepo.findOne.mockResolvedValue(mockAchievement);
      userAchievementRepo.create.mockReturnValue(mockUserAchievement);
      userAchievementRepo.save.mockResolvedValue(mockUserAchievement);
      progressRepo.update.mockResolvedValue({ affected: 1 });
      achievementRepo.increment.mockResolvedValue({ affected: 1 });

      const result = await service.unlockAchievement('user-1', 'ach-1');

      expect(result.userId).toBe('user-1');
      expect(result.pointsEarned).toBe(100);
    });

    it('returns existing event without duplicating when already unlocked', async () => {
      userAchievementRepo.findOne.mockResolvedValue(mockUserAchievement);

      const result = await service.unlockAchievement('user-1', 'ach-1');

      expect(userAchievementRepo.create).not.toHaveBeenCalled();
      expect(result.userId).toBe('user-1');
    });

    it('throws NotFoundException when achievement does not exist', async () => {
      userAchievementRepo.findOne.mockResolvedValue(null);
      achievementRepo.findOne.mockResolvedValue(null);

      await expect(service.unlockAchievement('user-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── initializeProgress ───────────────────────────────────────────────────

  describe('initializeProgress', () => {
    it('returns existing progress when already initialized', async () => {
      achievementRepo.findOne.mockResolvedValue(mockAchievement);
      progressRepo.findOne.mockResolvedValue(mockProgress);

      const result = await service.initializeProgress('user-1', 'ach-1');

      expect(progressRepo.create).not.toHaveBeenCalled();
      expect(result.id).toBe('prog-1');
    });

    it('creates new progress when none exists', async () => {
      achievementRepo.findOne.mockResolvedValue(mockAchievement);
      progressRepo.findOne.mockResolvedValue(null);
      progressRepo.create.mockReturnValue(mockProgress);
      progressRepo.save.mockResolvedValue(mockProgress);

      const result = await service.initializeProgress('user-1', 'ach-1');

      expect(progressRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('prog-1');
    });

    it('throws NotFoundException when achievement not found', async () => {
      achievementRepo.findOne.mockResolvedValue(null);

      await expect(service.initializeProgress('user-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getUserProgressForAchievement ────────────────────────────────────────

  describe('getUserProgressForAchievement', () => {
    it('returns the progress dto when found', async () => {
      progressRepo.findOne.mockResolvedValue(mockProgress);

      const result = await service.getUserProgressForAchievement('user-1', 'ach-1');

      expect(result.id).toBe('prog-1');
    });

    it('throws NotFoundException when progress is absent', async () => {
      progressRepo.findOne.mockResolvedValue(null);

      await expect(service.getUserProgressForAchievement('user-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
