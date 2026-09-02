import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MoreThanOrEqual } from 'typeorm';
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

    it('selects achievements unlocked since midnight today with notificationSent=false', async () => {
      const achievement = makeUserAchievement();
      mockRepo.find.mockResolvedValue([achievement]);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const count = await service.sendBatchNotifications();

      expect(count).toBe(1);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            unlockedAt: MoreThanOrEqual(today),
            notificationSent: false,
          },
        }),
      );
    });

    it('processes a large backlog in bounded chunks', async () => {
      const batchA = Array.from({ length: 100 }, () => makeUserAchievement());
      const batchB = Array.from({ length: 3 }, () => makeUserAchievement());
      // First call returns a full batch, second returns a short batch (loop ends).
      mockRepo.find.mockResolvedValueOnce(batchA).mockResolvedValueOnce(batchB);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const count = await service.sendBatchNotifications();

      expect(count).toBe(103);
      expect(mockRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
      expect(mockRepo.update).toHaveBeenCalledTimes(103);
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
