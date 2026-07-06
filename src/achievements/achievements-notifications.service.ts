import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAchievement } from './entities/user-achievement.entity';

/**
 * Achievements Notifications Service
 * Handles sending notifications when achievements are unlocked
 */
@Injectable()
export class AchievementsNotificationsService {
  private readonly logger = new Logger(AchievementsNotificationsService.name);

  constructor(
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
  ) {}

  /**
   * Send achievement unlocked notification to a user
   * In a real implementation, this would integrate with the NotificationsService
   */
  async sendAchievementUnlockedNotification(userAchievement: UserAchievement): Promise<void> {
    try {
      const achievement = userAchievement.achievement;
      const userId = userAchievement.user.id;

      // Build notification message
      const _title = '🎉 Achievement Unlocked!';
      const _message = `You've unlocked "${achievement.name}"! Earned ${achievement.pointsReward} points and ${achievement.experienceReward} XP.`;
      const _description = achievement.description;

      // In a real implementation, you would call the NotificationsService here
      // Example:
      // await this.notificationsService.createNotification({
      //   userId,
      //   type: 'ACHIEVEMENT_UNLOCKED',
      //   title,
      //   message,
      //   description,
      //   data: {
      //     achievementId: achievement.id,
      //     pointsEarned: achievement.pointsReward,
      //     experienceEarned: achievement.experienceReward,
      //     unlockedAt: userAchievement.unlockedAt,
      //   },
      // });

      this.logger.log(
        `Achievement notification would be sent to user ${userId}: ${achievement.name}`,
      );

      // Mark notification as sent
      await this.userAchievementRepository.update(
        { id: userAchievement.id },
        { notificationSent: true },
      );
    } catch (error) {
      this.logger.error(`Failed to send achievement notification: ${error.message}`, error.stack);
    }
  }

  /**
   * Send batch notifications for achievements unlocked today
   */
  async sendBatchNotifications(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const achievements = await this.userAchievementRepository.find({
        where: {
          unlockedAt: new Date(),
          notificationSent: false,
        },
        relations: ['user', 'achievement'],
      });

      let sentCount = 0;

      for (const userAchievement of achievements) {
        await this.sendAchievementUnlockedNotification(userAchievement);
        sentCount++;
      }

      this.logger.log(`Sent ${sentCount} achievement notifications`);
      return sentCount;
    } catch (error) {
      this.logger.error(`Failed to send batch notifications: ${error.message}`, error.stack);
      return 0;
    }
  }

  /**
   * Send resend notifications for failed deliveries
   */
  async resendFailedNotifications(): Promise<number> {
    try {
      const achievements = await this.userAchievementRepository.find({
        where: {
          notificationSent: false,
        },
        relations: ['user', 'achievement'],
        take: 100, // Process in batches
      });

      let resendCount = 0;

      for (const userAchievement of achievements) {
        await this.sendAchievementUnlockedNotification(userAchievement);
        resendCount++;
      }

      this.logger.log(`Resent ${resendCount} failed achievement notifications`);
      return resendCount;
    } catch (error) {
      this.logger.error(`Failed to resend notifications: ${error.message}`, error.stack);
      return 0;
    }
  }
}
