import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { Achievement, AchievementType, AchievementDifficulty } from './entities/achievement.entity';
import { AchievementProgress } from './entities/achievement-progress.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { AchievementStatistics } from './entities/achievement-statistics.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateAchievementDto,
  UpdateAchievementDto,
  AchievementResponseDto,
} from './dto/achievement.dto';
import { AchievementProgressDto, UpdateAchievementProgressDto } from './dto/achievement-progress.dto';
import { UserAchievementDto, AchievementUnlockedEventDto } from './dto/user-achievement.dto';
import {
  AchievementStatisticsDto,
  AchievementLeaderboardDto,
  AchievementOverviewDto,
} from './dto/achievement-statistics.dto';

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    @InjectRepository(Achievement)
    private achievementRepository: Repository<Achievement>,
    @InjectRepository(AchievementProgress)
    private progressRepository: Repository<AchievementProgress>,
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
    @InjectRepository(AchievementStatistics)
    private statisticsRepository: Repository<AchievementStatistics>,
  ) {}

  // =====================================================
  // Achievement Definition Management
  // =====================================================

  /**
   * Create a new achievement definition
   */
  async createAchievement(dto: CreateAchievementDto): Promise<AchievementResponseDto> {
    const achievement = this.achievementRepository.create({
      ...dto,
      isActive: true,
      unlockedBy: 0,
    });

    const saved = await this.achievementRepository.save(achievement);
    this.logger.log(`Achievement created: ${saved.id} - ${saved.name}`);

    return this.toAchievementResponseDto(saved);
  }

  /**
   * Get all achievements
   */
  async getAllAchievements(
    includeHidden: boolean = false,
  ): Promise<AchievementResponseDto[]> {
    const query = this.achievementRepository.createQueryBuilder('achievement');

    if (!includeHidden) {
      query.andWhere('achievement.isHidden = :isHidden', { isHidden: false });
    }

    const achievements = await query
      .andWhere('achievement.isActive = :isActive', { isActive: true })
      .orderBy('achievement.difficulty', 'ASC')
      .addOrderBy('achievement.createdAt', 'ASC')
      .getMany();

    return achievements.map((a) => this.toAchievementResponseDto(a));
  }

  /**
   * Get achievement by ID
   */
  async getAchievementById(achievementId: string): Promise<AchievementResponseDto> {
    const achievement = await this.achievementRepository.findOne({
      where: { id: achievementId },
    });

    if (!achievement) {
      throw new NotFoundException(`Achievement not found: ${achievementId}`);
    }

    return this.toAchievementResponseDto(achievement);
  }

  /**
   * Get achievements by type
   */
  async getAchievementsByType(type: AchievementType): Promise<AchievementResponseDto[]> {
    const achievements = await this.achievementRepository.find({
      where: { type, isActive: true, isHidden: false },
      order: { difficulty: 'ASC' },
    });

    return achievements.map((a) => this.toAchievementResponseDto(a));
  }

  /**
   * Update achievement definition
   */
  async updateAchievement(
    achievementId: string,
    dto: UpdateAchievementDto,
  ): Promise<AchievementResponseDto> {
    const achievement = await this.achievementRepository.findOne({
      where: { id: achievementId },
    });

    if (!achievement) {
      throw new NotFoundException(`Achievement not found: ${achievementId}`);
    }

    Object.assign(achievement, dto);
    const saved = await this.achievementRepository.save(achievement);

    this.logger.log(`Achievement updated: ${achievementId}`);
    return this.toAchievementResponseDto(saved);
  }

  /**
   * Delete achievement (soft delete via isActive flag)
   */
  async deactivateAchievement(achievementId: string): Promise<void> {
    await this.achievementRepository.update(
      { id: achievementId },
      { isActive: false },
    );

    this.logger.log(`Achievement deactivated: ${achievementId}`);
  }

  // =====================================================
  // Progress Tracking
  // =====================================================

  /**
   * Initialize progress tracking for a user toward an achievement
   */
  async initializeProgress(
    userId: string,
    achievementId: string,
  ): Promise<AchievementProgressDto> {
    const achievement = await this.achievementRepository.findOne({
      where: { id: achievementId },
    });

    if (!achievement) {
      throw new NotFoundException(`Achievement not found: ${achievementId}`);
    }

    // Check if progress already exists
    let progress = await this.progressRepository.findOne({
      where: {
        user: { id: userId },
        achievement: { id: achievementId },
      },
      relations: ['achievement'],
    });

    if (progress) {
      return this.toAchievementProgressDto(progress);
    }

    // Initialize new progress
    const targetProgress = achievement.progressConfig?.maxProgress || 1;

    progress = this.progressRepository.create({
      user: { id: userId } as User,
      achievement,
      currentProgress: 0,
      targetProgress,
      percentageComplete: 0,
      isUnlocked: false,
    });

    const saved = await this.progressRepository.save(progress);
    this.logger.log(
      `Progress initialized for user ${userId} toward achievement ${achievementId}`,
    );

    return this.toAchievementProgressDto(saved);
  }

  /**
   * Update achievement progress for a user
   */
  async updateProgress(
    userId: string,
    achievementId: string,
    dto: UpdateAchievementProgressDto,
  ): Promise<AchievementProgressDto> {
    let progress = await this.progressRepository.findOne({
      where: {
        user: { id: userId },
        achievement: { id: achievementId },
      },
      relations: ['achievement'],
    });

    if (!progress) {
      // Initialize if doesn't exist
      progress = await this.initializeProgress(userId, achievementId);
    }

    progress.currentProgress = Math.min(dto.currentProgress, progress.targetProgress);
    progress.percentageComplete = Math.round(
      (progress.currentProgress / progress.targetProgress) * 100,
    );
    progress.lastProgressUpdate = new Date();

    if (dto.metadata) {
      progress.metadata = { ...progress.metadata, ...dto.metadata };
    }

    const saved = await this.progressRepository.save(progress);

    this.logger.log(
      `Progress updated for user ${userId}: achievement ${achievementId} - ${progress.percentageComplete}%`,
    );

    // Check if achievement should be unlocked
    if (
      !progress.isUnlocked &&
      progress.currentProgress >= progress.targetProgress
    ) {
      await this.unlockAchievement(userId, achievementId);
    }

    return this.toAchievementProgressDto(saved);
  }

  /**
   * Get progress for a specific user toward an achievement
   */
  async getUserProgressForAchievement(
    userId: string,
    achievementId: string,
  ): Promise<AchievementProgressDto> {
    const progress = await this.progressRepository.findOne({
      where: {
        user: { id: userId },
        achievement: { id: achievementId },
      },
      relations: ['achievement'],
    });

    if (!progress) {
      throw new NotFoundException(
        `Progress not found for user ${userId} and achievement ${achievementId}`,
      );
    }

    return this.toAchievementProgressDto(progress);
  }

  /**
   * Get all progress records for a user
   */
  async getUserAllProgress(userId: string): Promise<AchievementProgressDto[]> {
    const progresses = await this.progressRepository.find({
      where: { user: { id: userId } },
      relations: ['achievement'],
      order: { createdAt: 'DESC' },
    });

    return progresses.map((p) => this.toAchievementProgressDto(p));
  }

  /**
   * Increment progress by a specified amount
   */
  async incrementProgress(
    userId: string,
    achievementId: string,
    incrementBy: number = 1,
    metadata?: any,
  ): Promise<AchievementProgressDto> {
    let progress = await this.progressRepository.findOne({
      where: {
        user: { id: userId },
        achievement: { id: achievementId },
      },
      relations: ['achievement'],
    });

    if (!progress) {
      progress = await this.initializeProgress(userId, achievementId);
    }

    const newProgress = Math.min(
      progress.currentProgress + incrementBy,
      progress.targetProgress,
    );

    return this.updateProgress(userId, achievementId, {
      currentProgress: newProgress,
      metadata,
    });
  }

  // =====================================================
  // Achievement Unlocking
  // =====================================================

  /**
   * Unlock an achievement for a user
   */
  async unlockAchievement(
    userId: string,
    achievementId: string,
    metadata?: any,
  ): Promise<AchievementUnlockedEventDto> {
    // Check if already unlocked
    const existing = await this.userAchievementRepository.findOne({
      where: {
        user: { id: userId },
        achievement: { id: achievementId },
      },
      relations: ['achievement'],
    });

    if (existing) {
      return this.toAchievementUnlockedEventDto(existing);
    }

    const achievement = await this.achievementRepository.findOne({
      where: { id: achievementId },
    });

    if (!achievement) {
      throw new NotFoundException(`Achievement not found: ${achievementId}`);
    }

    const userAchievement = this.userAchievementRepository.create({
      user: { id: userId } as User,
      achievement,
      unlockedAt: new Date(),
      unlockedMetadata: metadata,
      pointsEarned: achievement.pointsReward,
      experienceEarned: achievement.experienceReward,
      notificationSent: false,
    });

    const saved = await this.userAchievementRepository.save(userAchievement);

    // Update progress record
    await this.progressRepository.update(
      {
        user: { id: userId },
        achievement: { id: achievementId },
      },
      { isUnlocked: true },
    );

    // Increment unlocked count
    await this.achievementRepository.increment(
      { id: achievementId },
      'unlockedBy',
      1,
    );

    this.logger.log(
      `Achievement unlocked for user ${userId}: ${achievementId} - earned ${achievement.pointsReward} points, ${achievement.experienceReward} XP`,
    );

    return this.toAchievementUnlockedEventDto(saved);
  }

  /**
   * Get all unlocked achievements for a user
   */
  async getUserAchievements(userId: string): Promise<UserAchievementDto[]> {
    const achievements = await this.userAchievementRepository.find({
      where: { user: { id: userId } },
      relations: ['achievement'],
      order: { unlockedAt: 'DESC' },
    });

    return achievements.map((a) => this.toUserAchievementDto(a));
  }

  /**
   * Check if user has unlocked an achievement
   */
  async hasAchievement(userId: string, achievementId: string): Promise<boolean> {
    const achievement = await this.userAchievementRepository.findOne({
      where: {
        user: { id: userId },
        achievement: { id: achievementId },
      },
    });

    return !!achievement;
  }

  /**
   * Get achievement unlock count
   */
  async getUserAchievementCount(userId: string): Promise<number> {
    return this.userAchievementRepository.count({
      where: { user: { id: userId } },
    });
  }

  // =====================================================
  // Statistics and Analytics
  // =====================================================

  /**
   * Get statistics for an achievement
   */
  async getAchievementStatistics(achievementId: string): Promise<AchievementStatisticsDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const achievement = await this.achievementRepository.findOne({
      where: { id: achievementId },
    });

    if (!achievement) {
      throw new NotFoundException(`Achievement not found: ${achievementId}`);
    }

    const totalUnlocked = await this.userAchievementRepository.count({
      where: { achievement: { id: achievementId } },
    });

    const unlockedToday = await this.userAchievementRepository.count({
      where: {
        achievement: { id: achievementId },
        unlockedAt: MoreThan(today),
      },
    });

    const activeTrackers = await this.progressRepository.count({
      where: {
        achievement: { id: achievementId },
        isUnlocked: false,
      },
    });

    // Get average progress
    const progresses = await this.progressRepository.find({
      where: {
        achievement: { id: achievementId },
        isUnlocked: false,
      },
    });

    const averageProgress =
      progresses.length > 0
        ? progresses.reduce((sum, p) => sum + p.percentageComplete, 0) /
          progresses.length
        : 0;

    // Estimate total users (for percentage calculation)
    const totalUsers = await this.progressRepository
      .createQueryBuilder('progress')
      .select('COUNT(DISTINCT progress.userId)', 'count')
      .getRawOne();

    const unlockedPercentage =
      (totalUsers?.count > 0 ? (totalUnlocked / totalUsers.count) * 100 : 0) || 0;

    const stats = this.statisticsRepository.create({
      achievementId,
      date: today,
      totalUnlocked,
      unlockedToday,
      unlockedPercentage: Math.round(unlockedPercentage * 100) / 100,
      activeTrackers,
      averageProgress: Math.round(averageProgress * 100) / 100,
    });

    const saved = await this.statisticsRepository.save(stats);
    return this.toAchievementStatisticsDto(saved);
  }

  /**
   * Get user achievement overview
   */
  async getUserAchievementOverview(userId: string): Promise<AchievementOverviewDto> {
    const allAchievements = await this.achievementRepository.find({
      where: { isActive: true },
    });

    const userAchievements = await this.userAchievementRepository.find({
      where: { user: { id: userId } },
    });

    const totalPoints = userAchievements.reduce((sum, a) => sum + a.pointsEarned, 0);
    const totalExperience = userAchievements.reduce(
      (sum, a) => sum + a.experienceEarned,
      0,
    );

    // Get rank (users with more achievements ranked higher)
    const rank = await this.userAchievementRepository
      .createQueryBuilder('ua')
      .select('COUNT(DISTINCT ua.userId)', 'count')
      .where('(SELECT COUNT(*) FROM user_achievements WHERE "userId" = ua."userId") > :userCount', {
        userCount: userAchievements.length,
      })
      .getRawOne();

    const progressPercentage =
      allAchievements.length > 0
        ? Math.round((userAchievements.length / allAchievements.length) * 100)
        : 0;

    return {
      totalAchievements: allAchievements.length,
      unlockedAchievements: userAchievements.length,
      progressPercentage,
      totalPointsEarned: totalPoints,
      totalExperienceEarned: totalExperience,
      userRank: (rank?.count || 0) + 1,
    };
  }

  /**
   * Get achievements leaderboard
   */
  async getAchievementsLeaderboard(limit: number = 10): Promise<AchievementLeaderboardDto[]> {
    const results = await this.userAchievementRepository
      .createQueryBuilder('ua')
      .select('ua.userId', 'userId')
      .addSelect('COUNT(ua.id)', 'totalAchievements')
      .addSelect('SUM(ua.pointsEarned)', 'totalPoints')
      .addSelect('SUM(ua.experienceEarned)', 'totalExperience')
      .groupBy('ua.userId')
      .orderBy('totalAchievements', 'DESC')
      .addOrderBy('totalPoints', 'DESC')
      .limit(limit)
      .getRawMany();

    // Enhance with user info (could join with users table)
    return results.map((r, index) => ({
      userId: r.userId,
      username: r.userId, // Would need join to get actual username
      totalAchievements: parseInt(r.totalAchievements, 10),
      totalPoints: parseInt(r.totalPoints, 10) || 0,
      totalExperience: parseInt(r.totalExperience, 10) || 0,
      rank: index + 1,
    }));
  }

  /**
   * Get statistics for all achievements
   */
  async getAllAchievementsStatistics(): Promise<AchievementStatisticsDto[]> {
    const stats = await this.statisticsRepository.find({
      order: { date: 'DESC' },
    });

    return stats.map((s) => this.toAchievementStatisticsDto(s));
  }

  /**
   * Batch unlock achievements (for seeding or migrations)
   */
  async batchUnlockAchievements(
    userId: string,
    achievementIds: string[],
  ): Promise<AchievementUnlockedEventDto[]> {
    const results: AchievementUnlockedEventDto[] = [];

    for (const achievementId of achievementIds) {
      const result = await this.unlockAchievement(userId, achievementId);
      results.push(result);
    }

    return results;
  }

  // =====================================================
  // Helper Methods
  // =====================================================

  private toAchievementResponseDto(achievement: Achievement): AchievementResponseDto {
    return {
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      longDescription: achievement.longDescription,
      iconUrl: achievement.iconUrl,
      type: achievement.type,
      difficulty: achievement.difficulty,
      pointsReward: achievement.pointsReward,
      experienceReward: achievement.experienceReward,
      criteria: achievement.criteria,
      progressConfig: achievement.progressConfig,
      isActive: achievement.isActive,
      isHidden: achievement.isHidden,
      unlockedBy: achievement.unlockedBy,
      createdAt: achievement.createdAt,
      updatedAt: achievement.updatedAt,
    };
  }

  private toAchievementProgressDto(progress: AchievementProgress): AchievementProgressDto {
    return {
      id: progress.id,
      userId: progress.user.id,
      achievementId: progress.achievement.id,
      achievement: this.toAchievementResponseDto(progress.achievement),
      currentProgress: progress.currentProgress,
      targetProgress: progress.targetProgress,
      percentageComplete: progress.percentageComplete,
      isUnlocked: progress.isUnlocked,
      lastProgressUpdate: progress.lastProgressUpdate,
      metadata: progress.metadata,
      createdAt: progress.createdAt,
      updatedAt: progress.updatedAt,
    };
  }

  private toUserAchievementDto(userAchievement: UserAchievement): UserAchievementDto {
    return {
      id: userAchievement.id,
      userId: userAchievement.user.id,
      achievementId: userAchievement.achievement.id,
      achievement: this.toAchievementResponseDto(userAchievement.achievement),
      unlockedAt: userAchievement.unlockedAt,
      unlockedMetadata: userAchievement.unlockedMetadata,
      pointsEarned: userAchievement.pointsEarned,
      experienceEarned: userAchievement.experienceEarned,
      notificationSent: userAchievement.notificationSent,
      isHidden: userAchievement.isHidden,
      createdAt: userAchievement.createdAt,
      updatedAt: userAchievement.updatedAt,
    };
  }

  private toAchievementUnlockedEventDto(
    userAchievement: UserAchievement,
  ): AchievementUnlockedEventDto {
    return {
      userId: userAchievement.user.id,
      achievementId: userAchievement.achievement.id,
      achievement: this.toAchievementResponseDto(userAchievement.achievement),
      pointsEarned: userAchievement.pointsEarned,
      experienceEarned: userAchievement.experienceEarned,
      unlockedAt: userAchievement.unlockedAt,
    };
  }

  private toAchievementStatisticsDto(stats: AchievementStatistics): AchievementStatisticsDto {
    return {
      id: stats.id,
      achievementId: stats.achievementId,
      date: stats.date,
      totalUnlocked: stats.totalUnlocked,
      unlockedToday: stats.unlockedToday,
      unlockedPercentage: Number(stats.unlockedPercentage),
      averageTimeToUnlock: stats.averageTimeToUnlock,
      activeTrackers: stats.activeTrackers,
      averageProgress: Number(stats.averageProgress),
      engagementTrend: stats.engagementTrend,
      metadata: stats.metadata,
      createdAt: stats.createdAt,
      updatedAt: stats.updatedAt,
    };
  }
}
