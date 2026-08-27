import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AchievementsNotificationsService } from './achievements-notifications.service';
import { UserAchievement } from './entities/user-achievement.entity';
import { Achievement } from './entities/achievement.entity';
import { User } from '../users/entities/user.entity';

const makeUserAchievement = (): UserAchievement => {
  const user = { id: 'user-1' } as User;
  const achievement = {
    id: 'ach-1',
    name: 'First Steps',
    description: 'Complete your first lesson',
    pointsReward: 100,
    experienceReward: 50,
  } as Achievement;
  return {
    id: 'ua-1',
    user,
    achievement,
    unlockedAt: new Date(),
    notificationSent: false,
  } as UserAchievement;
};

describe('AchievementsNotificationsService', () => {
  let service: AchievementsNotificationsService;
  const mockRepo = {
    update: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementsNotificationsService,
        {
          provide: getRepositoryToken(UserAchievement),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<AchievementsNotificationsService>(AchievementsNotificationsService);
  });

  describe('sendAchievementUnlockedNotification', () => {
    it('marks notification as sent on success', async () => {
      const ua = makeUserAchievement();
      mockRepo.update.mockResolvedValue({ affected: 1 });

      await service.sendAchievementUnlockedNotification(ua);

      expect(mockRepo.update).toHaveBeenCalledWith({ id: ua.id }, { notificationSent: true });
    });

    it('does not throw when repository update fails', async () => {
      const ua = makeUserAchievement();
      mockRepo.update.mockRejectedValue(new Error('DB error'));

      await expect(service.sendAchievementUnlockedNotification(ua)).resolves.toBeUndefined();
    });
  });

  describe('sendBatchNotifications', () => {
    it('returns 0 when no pending achievements found', async () => {
      mockRepo.find.mockResolvedValue([]);

      const count = await service.sendBatchNotifications();

      expect(count).toBe(0);
    });

    it('returns number of sent notifications', async () => {
      const achievements = [makeUserAchievement(), makeUserAchievement()];
      mockRepo.find.mockResolvedValue(achievements);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const count = await service.sendBatchNotifications();

      expect(count).toBe(2);
    });

    it('returns 0 when find throws', async () => {
      mockRepo.find.mockRejectedValue(new Error('connection lost'));

      const count = await service.sendBatchNotifications();

      expect(count).toBe(0);
    });
  });

  describe('resendFailedNotifications', () => {
    it('returns 0 when no failed notifications exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const count = await service.resendFailedNotifications();

      expect(count).toBe(0);
    });

    it('retries up to 100 records and returns count', async () => {
      const achievements = Array.from({ length: 3 }, () => makeUserAchievement());
      mockRepo.find.mockResolvedValue(achievements);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const count = await service.resendFailedNotifications();

      expect(count).toBe(3);
    });

    it('returns 0 when find throws', async () => {
      mockRepo.find.mockRejectedValue(new Error('timeout'));

      const count = await service.resendFailedNotifications();

      expect(count).toBe(0);
    });
  });
});
