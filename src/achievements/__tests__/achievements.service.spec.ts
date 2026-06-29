import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AchievementsService } from '../achievements.service';
import {
  Achievement,
  AchievementType,
  AchievementDifficulty,
} from '../entities/achievement.entity';
import { AchievementProgress } from '../entities/achievement-progress.entity';
import { UserAchievement } from '../entities/user-achievement.entity';
import { AchievementStatistics } from '../entities/achievement-statistics.entity';
import { User } from '../../users/entities/user.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AchievementsService', () => {
  let service: AchievementsService;
  let achievementRepo: Repository<Achievement>;
  let progressRepo: Repository<AchievementProgress>;
  let userAchievementRepo: Repository<UserAchievement>;
  let statisticsRepo: Repository<AchievementStatistics>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: 'hashed',
  } as User;

  const mockAchievement: Achievement = {
    id: 'ach-123',
    name: 'First Steps',
    description: 'Complete your first lesson',
    longDescription: 'A detailed description',
    iconUrl: 'https://example.com/icon.png',
    type: AchievementType.MILESTONE,
    difficulty: AchievementDifficulty.EASY,
    pointsReward: 100,
    experienceReward: 50,
    criteria: { type: 'LESSONS_COMPLETED', target: 1 },
    progressConfig: { trackingType: 'incremental', maxProgress: 1 },
    isActive: true,
    isHidden: false,
    unlockedBy: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Achievement;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementsService,
        {
          provide: getRepositoryToken(Achievement),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            increment: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AchievementProgress),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserAchievement),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AchievementStatistics),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AchievementsService>(AchievementsService);
    achievementRepo = module.get<Repository<Achievement>>(getRepositoryToken(Achievement));
    progressRepo = module.get<Repository<AchievementProgress>>(
      getRepositoryToken(AchievementProgress),
    );
    userAchievementRepo = module.get<Repository<UserAchievement>>(
      getRepositoryToken(UserAchievement),
    );
    statisticsRepo = module.get<Repository<AchievementStatistics>>(
      getRepositoryToken(AchievementStatistics),
    );
  });

  describe('createAchievement', () => {
    it('should create a new achievement', async () => {
      const createDto = {
        name: 'First Steps',
        description: 'Complete your first lesson',
        iconUrl: 'https://example.com/icon.png',
        type: AchievementType.MILESTONE,
        difficulty: AchievementDifficulty.EASY,
        pointsReward: 100,
        experienceReward: 50,
        criteria: { type: 'LESSONS_COMPLETED', target: 1 },
        progressConfig: { trackingType: 'incremental', maxProgress: 1 },
      };

      jest.spyOn(achievementRepo, 'create').mockReturnValue(mockAchievement);
      jest.spyOn(achievementRepo, 'save').mockResolvedValue(mockAchievement);

      const result = await service.createAchievement(createDto);

      expect(result).toEqual({
        id: mockAchievement.id,
        name: mockAchievement.name,
        description: mockAchievement.description,
        longDescription: mockAchievement.longDescription,
        iconUrl: mockAchievement.iconUrl,
        type: mockAchievement.type,
        difficulty: mockAchievement.difficulty,
        pointsReward: mockAchievement.pointsReward,
        experienceReward: mockAchievement.experienceReward,
        criteria: mockAchievement.criteria,
        progressConfig: mockAchievement.progressConfig,
        isActive: mockAchievement.isActive,
        isHidden: mockAchievement.isHidden,
        unlockedBy: mockAchievement.unlockedBy,
        createdAt: mockAchievement.createdAt,
        updatedAt: mockAchievement.updatedAt,
      });
      expect(achievementRepo.create).toHaveBeenCalled();
      expect(achievementRepo.save).toHaveBeenCalled();
    });
  });

  describe('getAchievementById', () => {
    it('should get an achievement by ID', async () => {
      jest.spyOn(achievementRepo, 'findOne').mockResolvedValue(mockAchievement);

      const result = await service.getAchievementById('ach-123');

      expect(result.id).toBe(mockAchievement.id);
      expect(result.name).toBe(mockAchievement.name);
    });

    it('should throw NotFoundException if achievement not found', async () => {
      jest.spyOn(achievementRepo, 'findOne').mockResolvedValue(null);

      expect(service.getAchievementById('ach-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('unlockAchievement', () => {
    it('should unlock an achievement for a user', async () => {
      const mockUserAchievement: UserAchievement = {
        id: 'ua-123',
        user: mockUser,
        achievement: mockAchievement,
        unlockedAt: new Date(),
        pointsEarned: mockAchievement.pointsReward,
        experienceEarned: mockAchievement.experienceReward,
        notificationSent: false,
        isHidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserAchievement;

      jest.spyOn(userAchievementRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(achievementRepo, 'findOne').mockResolvedValue(mockAchievement);
      jest.spyOn(userAchievementRepo, 'create').mockReturnValue(mockUserAchievement);
      jest.spyOn(userAchievementRepo, 'save').mockResolvedValue(mockUserAchievement);
      jest.spyOn(progressRepo, 'update').mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(achievementRepo, 'increment').mockResolvedValue({ affected: 1 } as any);

      const result = await service.unlockAchievement('user-123', 'ach-123');

      expect(result.userId).toBe('user-123');
      expect(result.achievementId).toBe('ach-123');
      expect(result.pointsEarned).toBe(mockAchievement.pointsReward);
      expect(result.experienceEarned).toBe(mockAchievement.experienceReward);
    });

    it('should not duplicate unlocked achievement', async () => {
      const mockUserAchievement: UserAchievement = {
        id: 'ua-123',
        user: mockUser,
        achievement: mockAchievement,
        unlockedAt: new Date(),
        pointsEarned: mockAchievement.pointsReward,
        experienceEarned: mockAchievement.experienceReward,
        notificationSent: false,
        isHidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserAchievement;

      jest.spyOn(userAchievementRepo, 'findOne').mockResolvedValue(mockUserAchievement);

      const result = await service.unlockAchievement('user-123', 'ach-123');

      expect(result.userId).toBe('user-123');
      expect(userAchievementRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('updateProgress', () => {
    it('should update achievement progress', async () => {
      const mockProgress: AchievementProgress = {
        id: 'prog-123',
        user: mockUser,
        achievement: mockAchievement,
        currentProgress: 0,
        targetProgress: 100,
        percentageComplete: 0,
        isUnlocked: false,
        lastProgressUpdate: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AchievementProgress;

      jest.spyOn(progressRepo, 'findOne').mockResolvedValue(mockProgress);
      jest.spyOn(progressRepo, 'save').mockImplementation(((progress: any) => {
        progress.currentProgress = 50;
        progress.percentageComplete = 50;
        return Promise.resolve(progress);
      }) as any);

      const result = await service.updateProgress('user-123', 'ach-123', {
        currentProgress: 50,
      });

      expect(result.currentProgress).toBe(50);
      expect(result.percentageComplete).toBe(50);
    });

    it('should initialize progress if it does not exist', async () => {
      jest.spyOn(progressRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(achievementRepo, 'findOne').mockResolvedValue(mockAchievement);
      jest.spyOn(progressRepo, 'create').mockReturnValue({
        user: mockUser,
        achievement: mockAchievement,
        currentProgress: 0,
        targetProgress: 100,
        percentageComplete: 0,
      } as AchievementProgress);
      jest.spyOn(progressRepo, 'save').mockResolvedValue({
        id: 'prog-123',
        user: mockUser,
        achievement: mockAchievement,
        currentProgress: 50,
        targetProgress: 100,
        percentageComplete: 50,
        isUnlocked: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastProgressUpdate: null,
      } as AchievementProgress);

      const result = await service.updateProgress('user-123', 'ach-123', {
        currentProgress: 50,
      });

      expect(result.currentProgress).toBe(50);
    });
  });

  describe('getUserAchievements', () => {
    it('should get all achievements for a user', async () => {
      const mockUserAchievements: UserAchievement[] = [
        {
          id: 'ua-1',
          user: mockUser,
          achievement: mockAchievement,
          unlockedAt: new Date(),
          pointsEarned: 100,
          experienceEarned: 50,
          notificationSent: true,
          isHidden: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as UserAchievement,
      ];

      jest.spyOn(userAchievementRepo, 'find').mockResolvedValue(mockUserAchievements);

      const result = await service.getUserAchievements('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-123');
      expect(result[0].achievementId).toBe('ach-123');
    });
  });

  describe('incrementProgress', () => {
    it('should increment progress', async () => {
      const mockProgress: AchievementProgress = {
        id: 'prog-123',
        user: mockUser,
        achievement: mockAchievement,
        currentProgress: 0,
        targetProgress: 10,
        percentageComplete: 0,
        isUnlocked: false,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        lastProgressUpdate: null,
      } as AchievementProgress;

      jest.spyOn(progressRepo, 'findOne').mockResolvedValue(mockProgress);
      jest.spyOn(progressRepo, 'save').mockImplementation(((progress: any) => {
        progress.currentProgress = 1;
        progress.percentageComplete = 10;
        return Promise.resolve(progress);
      }) as any);

      const result = await service.incrementProgress('user-123', 'ach-123', 1);

      expect(result.currentProgress).toBe(1);
      expect(result.percentageComplete).toBe(10);
    });
  });

  describe('getUserAchievementOverview', () => {
    it('should get user achievement overview', async () => {
      jest.spyOn(achievementRepo, 'find').mockResolvedValue([mockAchievement]);

      const mockUserAchievements: UserAchievement[] = [
        {
          id: 'ua-1',
          user: mockUser,
          achievement: mockAchievement,
          unlockedAt: new Date(),
          pointsEarned: 100,
          experienceEarned: 50,
          notificationSent: true,
          isHidden: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as UserAchievement,
      ];

      jest.spyOn(userAchievementRepo, 'find').mockResolvedValue(mockUserAchievements);
      jest.spyOn(userAchievementRepo, 'createQueryBuilder').mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: 10 }),
      } as any);

      const result = await service.getUserAchievementOverview('user-123');

      expect(result.totalAchievements).toBe(1);
      expect(result.unlockedAchievements).toBe(1);
      expect(result.totalPointsEarned).toBe(100);
      expect(result.totalExperienceEarned).toBe(50);
      expect(result.progressPercentage).toBe(100);
    });
  });

  describe('hasAchievement', () => {
    it('should return true if user has achievement', async () => {
      const mockUserAchievement = { id: 'ua-123' } as UserAchievement;
      jest.spyOn(userAchievementRepo, 'findOne').mockResolvedValue(mockUserAchievement);

      const result = await service.hasAchievement('user-123', 'ach-123');

      expect(result).toBe(true);
    });

    it('should return false if user does not have achievement', async () => {
      jest.spyOn(userAchievementRepo, 'findOne').mockResolvedValue(null);

      const result = await service.hasAchievement('user-123', 'ach-999');

      expect(result).toBe(false);
    });
  });
});
