/**
 * Integration Example: How to use the Achievements System
 * This file demonstrates how to integrate the achievement system with other modules
 */

import { Injectable } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { AchievementsNotificationsService } from './achievements-notifications.service';
import { AchievementType, AchievementDifficulty } from './entities/achievement.entity';

@Injectable()
export class AchievementsIntegrationExample {
  constructor(
    private achievementsService: AchievementsService,
    private notificationsService: AchievementsNotificationsService,
  ) {}

  /**
   * EXAMPLE 1: When a user completes a lesson
   * Call this from the lessons service
   */
  async onLessonCompleted(userId: string, lessonId: string): Promise<void> {
    // 1. Get or initialize progress for lesson-based achievements
    const completionAchievement = 'lessons-completed-achievement-id'; // In real code, fetch by criteria

    // 2. Increment progress
    await this.achievementsService.incrementProgress(userId, completionAchievement, 1, {
      lessonId,
      completedAt: new Date(),
    });

    // 3. Check if user earned any new achievements
    const userAchievements = await this.achievementsService.getUserAchievements(userId);
    console.log(`User has ${userAchievements.length} achievements`);
  }

  /**
   * EXAMPLE 2: When a user completes a course
   * Call this from the courses service
   */
  async onCourseCompleted(userId: string, courseId: string): Promise<void> {
    const courseCompletionAchievement = 'courses-completed-achievement-id';

    // Increment progress
    const progress = await this.achievementsService.incrementProgress(
      userId,
      courseCompletionAchievement,
      1,
      {
        courseId,
        completedAt: new Date(),
      },
    );

    console.log(
      `User progress: ${progress.currentProgress}/${progress.targetProgress} (${progress.percentageComplete}%)`,
    );
  }

  /**
   * EXAMPLE 3: Daily streak tracking
   * Call this daily (via a cron job or scheduler)
   */
  async updateDailyStreaks(userId: string): Promise<void> {
    const streakAchievementId = 'week-warrior-achievement-id';

    // Get current streak
    const progress = await this.achievementsService.getUserProgressForAchievement(
      userId,
      streakAchievementId,
    );

    // Check if user has completed a lesson today
    const completedTodayInProgress = true; // Check via lesson service

    if (completedTodayInProgress) {
      // Increment streak
      const updated = await this.achievementsService.incrementProgress(
        userId,
        streakAchievementId,
        1,
        {
          date: new Date().toISOString().split('T')[0],
        },
      );

      console.log(`Streak updated: ${updated.currentProgress} days`);
    }
  }

  /**
   * EXAMPLE 4: Manual achievement unlock
   * Call this for special cases or admin actions
   */
  async awardAchievementManually(userId: string, achievementName: string): Promise<void> {
    // 1. Find achievement by name
    const achievements = await this.achievementsService.getAllAchievements();
    const achievement = achievements.find((a) => a.name === achievementName);

    if (!achievement) {
      console.error(`Achievement not found: ${achievementName}`);
      return;
    }

    // 2. Unlock achievement
    const unlockedEvent = await this.achievementsService.unlockAchievement(
      userId,
      achievement.id,
      {
        reason: 'manual_award',
        adminId: 'admin-user-id',
      },
    );

    console.log(`Achievement unlocked: ${achievement.name}`);
    console.log(`Points earned: ${unlockedEvent.pointsEarned}`);
    console.log(`Experience earned: ${unlockedEvent.experienceEarned}`);
  }

  /**
   * EXAMPLE 5: Getting user's achievement progress
   * Use this for displaying user profile/dashboard
   */
  async getUserAchievementDashboard(userId: string): Promise<any> {
    // Get overview
    const overview = await this.achievementsService.getUserAchievementOverview(userId);

    // Get all achievements with progress
    const allAchievements = await this.achievementsService.getAllAchievements();
    const userProgress = await this.achievementsService.getUserAllProgress(userId);
    const userUnlocked = await this.achievementsService.getUserAchievements(userId);

    return {
      summary: overview,
      progress: userProgress.map((p) => ({
        achievement: p.achievement.name,
        progress: `${p.currentProgress}/${p.targetProgress}`,
        percentage: p.percentageComplete,
      })),
      unlocked: userUnlocked.map((a) => ({
        achievement: a.achievement.name,
        unlockedAt: a.unlockedAt,
        pointsEarned: a.pointsEarned,
      })),
    };
  }

  /**
   * EXAMPLE 6: Getting system statistics
   * Use this for admin dashboards
   */
  async getSystemAchievementStats(): Promise<any> {
    const achievements = await this.achievementsService.getAllAchievements();
    const leaderboard = await this.achievementsService.getAchievementsLeaderboard(10);

    const statsByAchievement = await Promise.all(
      achievements.map(async (achievement) => {
        const stats = await this.achievementsService.getAchievementStatistics(achievement.id);
        return {
          name: achievement.name,
          totalUnlocked: stats.totalUnlocked,
          unlockedPercentage: stats.unlockedPercentage,
          activeTrackers: stats.activeTrackers,
          engagementTrend: stats.engagementTrend,
        };
      }),
    );

    return {
      topAchievements: statsByAchievement.sort((a, b) => b.totalUnlocked - a.totalUnlocked),
      topUsers: leaderboard,
      totalAchievements: achievements.length,
    };
  }

  /**
   * EXAMPLE 7: Creating a new achievement
   * Call this during setup or admin operations
   */
  async createNewAchievement(): Promise<void> {
    const newAchievement = await this.achievementsService.createAchievement({
      name: 'Code Reviewer',
      description: 'Review 10 peer submissions',
      longDescription: 'Become an expert code reviewer by providing feedback on 10 submissions',
      iconUrl: 'https://example.com/icons/code-reviewer.png',
      type: AchievementType.ENGAGEMENT,
      difficulty: AchievementDifficulty.HARD,
      pointsReward: 400,
      experienceReward: 200,
      criteria: {
        type: 'PEER_REVIEWS',
        target: 10,
      },
      progressConfig: {
        trackingType: 'incremental',
        maxProgress: 10,
      },
    });

    console.log(`Achievement created: ${newAchievement.id}`);
  }

  /**
   * EXAMPLE 8: Checking user achievement status
   * Use this for authorization or feature gates
   */
  async checkUserAchievementForFeatureGate(
    userId: string,
    achievementName: string,
  ): Promise<boolean> {
    const achievements = await this.achievementsService.getAllAchievements();
    const achievement = achievements.find((a) => a.name === achievementName);

    if (!achievement) {
      return false;
    }

    return this.achievementsService.hasAchievement(userId, achievement.id);
  }

  /**
   * EXAMPLE 9: Bulk operations for testing/migrations
   * Use this for seeding or data operations
   */
  async bulkUnlockAchievementsForUser(userId: string, count: number): Promise<void> {
    const achievements = await this.achievementsService.getAllAchievements();
    const achievementsToUnlock = achievements.slice(0, count).map((a) => a.id);

    await this.achievementsService.batchUnlockAchievements(userId, achievementsToUnlock);

    console.log(`Unlocked ${achievementsToUnlock.length} achievements for user ${userId}`);
  }

  /**
   * EXAMPLE 10: Integration with notification service
   * Send notifications when achievements are unlocked
   */
  async onAchievementUnlocked(userId: string, achievementId: string): Promise<void> {
    const achievement = await this.achievementsService.getAchievementById(achievementId);

    // This would integrate with the NotificationsService
    const notificationData = {
      userId,
      type: 'ACHIEVEMENT_UNLOCKED',
      title: `🎉 Achievement Unlocked!`,
      message: `You've unlocked "${achievement.name}"!`,
      data: {
        achievementId,
        pointsEarned: achievement.pointsReward,
        experienceEarned: achievement.experienceReward,
      },
    };

    // await this.notificationsService.sendNotification(notificationData);
    console.log('Notification would be sent:', notificationData);
  }
}

/**
 * USAGE IN OTHER MODULES:
 *
 * 1. In CoursesService (when course is completed):
 *    constructor(private achievements: AchievementsService) {}
 *    async completeCourse(userId: string, courseId: string) {
 *      // ... course completion logic
 *      await this.achievements.incrementProgress(userId, 'course-completion-id', 1);
 *    }
 *
 * 2. In a Scheduler (for daily streaks):
 *    @Cron('0 23 * * *')  // Daily at 11 PM
 *    async updateStreaks() {
 *      const users = await this.usersService.getAllActiveUsers();
 *      for (const user of users) {
 *        await this.achievements.updateDailyStreaks(user.id);
 *      }
 *    }
 *
 * 3. In a Guard (for feature access):
 *    canActivate(context: ExecutionContext) {
 *      const hasAch = await this.achievements.hasAchievement(userId, achId);
 *      return hasAch;
 *    }
 */
