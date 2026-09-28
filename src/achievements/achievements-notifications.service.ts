import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
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
   * Processes achievements in bounded chunks so a large backlog is not
   * loaded or sent in a single tight loop.
   */
  async sendBatchNotifications(): Promise<number> {
    const BATCH_SIZE = 100;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let sentCount = 0;
      let skip = 0;
      let keepProcessing = true;

      while (keepProcessing) {
        const achievements = await this.userAchievementRepository.find({
          where: {
            unlockedAt: MoreThanOrEqual(today),
            notificationSent: false,
          },
          relations: ['user', 'achievement'],
          take: BATCH_SIZE,
          skip,
        });

        if (achievements.length === 0) {
          keepProcessing = false;
          continue;
        }

        for (const userAchievement of achievements) {
          await this.sendAchievementUnlockedNotification(userAchievement);
          sentCount++;
        }

        skip += achievements.length;

        // Stop when a chunk returns fewer than the batch size (no more pending).
        keepProcessing = achievements.length === BATCH_SIZE;
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
