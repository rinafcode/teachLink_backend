import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AchievementsController } from '../achievements.controller';
import { AchievementsService } from '../achievements.service';
import {
  Achievement,
  AchievementType,
  AchievementDifficulty,
} from '../entities/achievement.entity';
import { AchievementProgress } from '../entities/achievement-progress.entity';
import { UserAchievement } from '../entities/user-achievement.entity';
import { AchievementStatistics } from '../entities/achievement-statistics.entity';

describe('AchievementsController', () => {
  let controller: AchievementsController;
  let service: AchievementsService;

  const mockAchievementResponseDto = {
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AchievementsController],
      providers: [
        {
          provide: AchievementsService,
          useValue: {
            createAchievement: jest.fn(),
            getAllAchievements: jest.fn(),
            getAchievementsByType: jest.fn(),
            getAchievementById: jest.fn(),
            updateAchievement: jest.fn(),
            deactivateAchievement: jest.fn(),
            initializeProgress: jest.fn(),
            getUserProgressForAchievement: jest.fn(),
            updateProgress: jest.fn(),
            incrementProgress: jest.fn(),
            getUserAllProgress: jest.fn(),
            unlockAchievement: jest.fn(),
            getUserAchievements: jest.fn(),
            hasAchievement: jest.fn(),
            getUserAchievementCount: jest.fn(),
            getAchievementStatistics: jest.fn(),
            getUserAchievementOverview: jest.fn(),
            getAchievementsLeaderboard: jest.fn(),
            getAllAchievementsStatistics: jest.fn(),
            batchUnlockAchievements: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AchievementsController>(AchievementsController);
    service = module.get<AchievementsService>(AchievementsService);
  });

  describe('createAchievement', () => {
    it('should create an achievement', async () => {
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

      jest.spyOn(service, 'createAchievement').mockResolvedValue(mockAchievementResponseDto);

      const result = await controller.createAchievement(createDto);

      expect(result).toEqual(mockAchievementResponseDto);
      expect(service.createAchievement).toHaveBeenCalledWith(createDto);
    });
  });

  describe('getAllAchievements', () => {
    it('should get all achievements', async () => {
      jest.spyOn(service, 'getAllAchievements').mockResolvedValue([mockAchievementResponseDto]);

      const result = await controller.getAllAchievements();

      expect(result).toEqual([mockAchievementResponseDto]);
      expect(service.getAllAchievements).toHaveBeenCalledWith(false);
    });
  });

  describe('getAchievementById', () => {
    it('should get achievement by id', async () => {
      jest.spyOn(service, 'getAchievementById').mockResolvedValue(mockAchievementResponseDto);

      const result = await controller.getAchievementById('ach-123');

      expect(result).toEqual(mockAchievementResponseDto);
      expect(service.getAchievementById).toHaveBeenCalledWith('ach-123');
    });
  });

  describe('updateAchievement', () => {
    it('should update an achievement', async () => {
      const updateDto = { name: 'Updated Name' };
      const updatedResponse = { ...mockAchievementResponseDto, name: 'Updated Name' };

      jest.spyOn(service, 'updateAchievement').mockResolvedValue(updatedResponse);

      const result = await controller.updateAchievement('ach-123', updateDto);

      expect(result.name).toBe('Updated Name');
      expect(service.updateAchievement).toHaveBeenCalledWith('ach-123', updateDto);
    });
  });

  describe('unlockAchievement', () => {
    it('should unlock an achievement', async () => {
      const mockUnlockedEvent = {
        userId: 'user-123',
        achievementId: 'ach-123',
        achievement: mockAchievementResponseDto,
        pointsEarned: 100,
        experienceEarned: 50,
        unlockedAt: new Date(),
      };

      jest.spyOn(service, 'unlockAchievement').mockResolvedValue(mockUnlockedEvent);

      const result = await controller.unlockAchievement('ach-123', 'user-123');

      expect(result.userId).toBe('user-123');
      expect(result.achievementId).toBe('ach-123');
      expect(service.unlockAchievement).toHaveBeenCalledWith('user-123', 'ach-123', undefined);
    });
  });

  describe('getUserAchievements', () => {
    it('should get user achievements', async () => {
      const mockUserAchievements = [
        {
          id: 'ua-1',
          userId: 'user-123',
          achievementId: 'ach-123',
          achievement: mockAchievementResponseDto,
          unlockedAt: new Date(),
          pointsEarned: 100,
          experienceEarned: 50,
          notificationSent: true,
          isHidden: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(service, 'getUserAchievements').mockResolvedValue(mockUserAchievements);

      const result = await controller.getUserAchievements('user-123');

      expect(result).toEqual(mockUserAchievements);
      expect(service.getUserAchievements).toHaveBeenCalledWith('user-123');
    });
  });

  describe('hasAchievement', () => {
    it('should check if user has achievement', async () => {
      jest.spyOn(service, 'hasAchievement').mockResolvedValue(true);

      const result = await controller.hasAchievement('ach-123', 'user-123');

      expect(result).toEqual({ hasAchievement: true });
      expect(service.hasAchievement).toHaveBeenCalledWith('user-123', 'ach-123');
    });
  });

  describe('getUserAchievementCount', () => {
    it('should get user achievement count', async () => {
      jest.spyOn(service, 'getUserAchievementCount').mockResolvedValue(5);

      const result = await controller.getUserAchievementCount('user-123');

      expect(result).toEqual({ count: 5 });
      expect(service.getUserAchievementCount).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getAchievementsLeaderboard', () => {
    it('should get achievements leaderboard', async () => {
      const mockLeaderboard = [
        {
          userId: 'user-1',
          username: 'user1',
          totalAchievements: 10,
          totalPoints: 1000,
          totalExperience: 500,
          rank: 1,
        },
      ];

      jest.spyOn(service, 'getAchievementsLeaderboard').mockResolvedValue(mockLeaderboard);

      const result = await controller.getAchievementsLeaderboard('10');

      expect(result).toEqual(mockLeaderboard);
      expect(service.getAchievementsLeaderboard).toHaveBeenCalledWith(10);
    });
  });

  describe('getUserAchievementOverview', () => {
    it('should get user achievement overview', async () => {
      const mockOverview = {
        totalAchievements: 10,
        unlockedAchievements: 5,
        progressPercentage: 50,
        totalPointsEarned: 500,
        totalExperienceEarned: 250,
        userRank: 15,
      };

      jest.spyOn(service, 'getUserAchievementOverview').mockResolvedValue(mockOverview);

      const result = await controller.getUserAchievementOverview('user-123');

      expect(result).toEqual(mockOverview);
      expect(service.getUserAchievementOverview).toHaveBeenCalledWith('user-123');
    });
  });
});
