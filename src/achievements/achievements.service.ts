import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, MoreThan } from 'typeorm';
import { Achievement, AchievementType } from './entities/achievement.entity';
import { AchievementProgress } from './entities/achievement-progress.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { AchievementStatistics } from './entities/achievement-statistics.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateAchievementDto,
  UpdateAchievementDto,
  AchievementResponseDto,
} from './dto/achievement.dto';
import {
  AchievementProgressDto,
  UpdateAchievementProgressDto,
} from './dto/achievement-progress.dto';
import { UserAchievementDto, AchievementUnlockedEventDto } from './dto/user-achievement.dto';
import {
  AchievementStatisticsDto,
  AchievementLeaderboardDto,
  AchievementOverviewDto,
} from './dto/achievement-statistics.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { OffsetPaginatedResponse } from '../common/interfaces/pagination.interface';
import { buildOffsetResponse, clampLimit } from '../common/utils/pagination.utils';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

const ACHIEVEMENTS_CACHE_KEY = 'achievements_definitions';

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
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly dataSource: DataSource,
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

    await this.cacheManager.del(ACHIEVEMENTS_CACHE_KEY);

    return this.toAchievementResponseDto(saved);
  }

  /**
   * Get all achievements
   */
  async getAllAchievements(
    includeHidden: boolean = false,
    query?: PaginationQueryDto,
  ): Promise<OffsetPaginatedResponse<AchievementResponseDto>> {
    const page = query?.page ?? 1;
    const limit = clampLimit(query?.limit);

    const qb = this.achievementRepository.createQueryBuilder('achievement');

    if (!includeHidden) {
      qb.andWhere('achievement.isHidden = :isHidden', { isHidden: false });
    }

    qb.andWhere('achievement.isActive = :isActive', { isActive: true })
      .orderBy('achievement.difficulty', 'ASC')
      .addOrderBy('achievement.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [achievements, total] = await qb.getManyAndCount();

    const dtos = achievements.map((a) => this.toAchievementResponseDto(a));
    return buildOffsetResponse(dtos, total, page, limit);
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
  async getAchievementsByType(
    type: AchievementType,
    query?: PaginationQueryDto,
  ): Promise<OffsetPaginatedResponse<AchievementResponseDto>> {
    const page = query?.page ?? 1;
    const limit = clampLimit(query?.limit);

    const [achievements, total] = await this.achievementRepository.findAndCount({
      where: { type, isActive: true, isHidden: false },
      order: { difficulty: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const dtos = achievements.map((a) => this.toAchievementResponseDto(a));
    return buildOffsetResponse(dtos, total, page, limit);
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
    await this.cacheManager.del(ACHIEVEMENTS_CACHE_KEY);
    return this.toAchievementResponseDto(saved);
  }

  /**
   * Delete achievement (soft delete via isActive flag)
   */
  async deactivateAchievement(achievementId: string): Promise<void> {
    await this.achievementRepository.update({ id: achievementId }, { isActive: false });

    await this.cacheManager.del(ACHIEVEMENTS_CACHE_KEY);
    this.logger.log(`Achievement deactivated: ${achievementId}`);
  }

  // =====================================================
  // Progress Tracking
  // =====================================================

  /**
   * Initialize progress tracking for a user toward an achievement
   */
  async initializeProgress(userId: string, achievementId: string): Promise<AchievementProgress> {
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
      return progress;
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
    this.logger.log(`Progress initialized for user ${userId} toward achievement ${achievementId}`);

    return saved;
  }

  /**
   * Update achievement progress for a user
   */
  async updateProgress(
    userId: string,
    achievementId: string,
    dto: UpdateAchievementProgressDto,
  ): Promise<AchievementProgressDto> {
    // Progress save + potential unlock are one logical operation: if the unlock
    // writes fail, the progress change must roll back with them (issue #1344).
    return this.dataSource.transaction(async (manager) => {
      const progressRepository = manager.getRepository(AchievementProgress);
      const achievementRepository = manager.getRepository(Achievement);

      let progress = await progressRepository.findOne({
        where: {
          user: { id: userId },
          achievement: { id: achievementId },
        },
        relations: ['achievement'],
      });

      if (!progress) {
        // Initialize if it doesn't exist (same logic as initializeProgress).
        const achievement = await achievementRepository.findOne({
          where: { id: achievementId },
        });
        if (!achievement) {
          throw new NotFoundException(`Achievement not found: ${achievementId}`);
        }
        const targetProgress = achievement.progressConfig?.maxProgress || 1;
        progress = progressRepository.create({
          user: { id: userId } as User,
          achievement,
          currentProgress: 0,
          targetProgress,
          percentageComplete: 0,
          isUnlocked: false,
        });
      }

      progress.currentProgress = Math.min(dto.currentProgress, progress.targetProgress);
      progress.percentageComplete = Math.round(
        (progress.currentProgress / progress.targetProgress) * 100,
      );
      progress.lastProgressUpdate = new Date();

      if (dto.metadata) {
        progress.metadata = { ...progress.metadata, ...dto.metadata };
      }

      const saved = await progressRepository.save(progress);

      this.logger.log(
        `Progress updated for user ${userId}: achievement ${achievementId} - ${progress.percentageComplete}%`,
      );

      // Check if achievement should be unlocked
      if (!progress.isUnlocked && progress.currentProgress >= progress.targetProgress) {
        await this.unlockWithManager(manager, userId, achievementId);
      }

      return this.toAchievementProgressDto(saved);
    });
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
  async getUserAllProgress(
    userId: string,
    query?: PaginationQueryDto,
  ): Promise<OffsetPaginatedResponse<AchievementProgressDto>> {
    const page = query?.page ?? 1;
    const limit = clampLimit(query?.limit);

    const [progresses, total] = await this.progressRepository.findAndCount({
      where: { user: { id: userId } },
      relations: ['achievement'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const dtos = progresses.map((p) => this.toAchievementProgressDto(p));
    return buildOffsetResponse(dtos, total, page, limit);
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

    const newProgress = Math.min(progress.currentProgress + incrementBy, progress.targetProgress);

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
    // The unlock row, progress update and unlocked-count bump are one logical
    // operation: all commit together or none do (issue #1344).
    return this.dataSource.transaction(async (manager) =>
      this.unlockWithManager(manager, userId, achievementId, metadata),
    );
  }

  private async unlockWithManager(
    manager: EntityManager,
    userId: string,
    achievementId: string,
    metadata?: any,
  ): Promise<AchievementUnlockedEventDto> {
    const userAchievementRepository = manager.getRepository(UserAchievement);
    const progressRepository = manager.getRepository(AchievementProgress);
    const achievementRepository = manager.getRepository(Achievement);

    // Check if already unlocked
    const existing = await userAchievementRepository.findOne({
      where: {
        user: { id: userId },
        achievement: { id: achievementId },
      },
      relations: ['achievement'],
    });

    if (existing) {
      return this.toAchievementUnlockedEventDto(existing);
    }

    const achievement = await achievementRepository.findOne({
      where: { id: achievementId },
    });

    if (!achievement) {
      throw new NotFoundException(`Achievement not found: ${achievementId}`);
    }

    const userAchievement = userAchievementRepository.create({
      user: { id: userId } as User,
      achievement,
      unlockedAt: new Date(),
      unlockedMetadata: metadata,
      pointsEarned: achievement.pointsReward,
      experienceEarned: achievement.experienceReward,
      notificationSent: false,
    });

    const saved = await userAchievementRepository.save(userAchievement);

    // Update progress record
    await progressRepository.update(
      {
        user: { id: userId },
        achievement: { id: achievementId },
      },
      { isUnlocked: true },
    );

    // Increment unlocked count
    await achievementRepository.increment({ id: achievementId }, 'unlockedBy', 1);

    this.logger.log(
      `Achievement unlocked for user ${userId}: ${achievementId} - earned ${achievement.pointsReward} points, ${achievement.experienceReward} XP`,
    );

    return this.toAchievementUnlockedEventDto(saved);
  }

  /**
   * Get all unlocked achievements for a user
   */
  async getUserAchievements(
    userId: string,
    query?: PaginationQueryDto,
  ): Promise<OffsetPaginatedResponse<UserAchievementDto>> {
    const page = query?.page ?? 1;
    const limit = clampLimit(query?.limit);

    const [achievements, total] = await this.userAchievementRepository.findAndCount({
      where: { user: { id: userId } },
      relations: ['achievement'],
      order: { unlockedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const dtos = achievements.map((a) => this.toUserAchievementDto(a));
    return buildOffsetResponse(dtos, total, page, limit);
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
        ? progresses.reduce((sum, p) => sum + p.percentageComplete, 0) / progresses.length
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
    // 1. Get total number of active achievements (cacheable)
    let totalAchievements = await this.cacheManager.get<number>('total_achievements');
    if (totalAchievements === undefined || totalAchievements === null) {
      totalAchievements = await this.achievementRepository.count({ where: { isActive: true } });
      await this.cacheManager.set('total_achievements', totalAchievements, 3600 * 1000); // 1 hour TTL
    }

    // 2. Fetch user's achievements count, points, and XP in one query
    const userStats = await this.userAchievementRepository
      .createQueryBuilder('ua')
      .select('COUNT(ua.id)', 'unlockedCount')
      .addSelect('COALESCE(SUM(ua.pointsEarned), 0)', 'totalPoints')
      .addSelect('COALESCE(SUM(ua.experienceEarned), 0)', 'totalExperience')
      .where('ua.userId = :userId', { userId })
      .getRawOne();

    const unlockedCount = parseInt(userStats?.unlockedCount || '0', 10);
    const totalPoints = parseInt(userStats?.totalPoints || '0', 10);
    const totalExperience = parseInt(userStats?.totalExperience || '0', 10);

    // Get rank (users with more achievements ranked higher)
    const rank = await this.userAchievementRepository
      .createQueryBuilder('ua')
      .select('COUNT(DISTINCT ua.userId)', 'count')
      .where('(SELECT COUNT(*) FROM user_achievements WHERE "userId" = ua."userId") > :userCount', {
        userCount: unlockedCount,
      })
      .getRawOne();
    const progressPercentage =
      totalAchievements > 0 ? Math.round((unlockedCount / totalAchievements) * 100) : 0;

    return {
      totalAchievements,
      unlockedAchievements: unlockedCount,
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
    // The whole batch is one logical operation: a failure in any unlock rolls
    // back every unlock in the batch (issue #1344).
    return this.dataSource.transaction(async (manager) => {
      const results: AchievementUnlockedEventDto[] = [];

      for (const achievementId of achievementIds) {
        const result = await this.unlockWithManager(manager, userId, achievementId);
        results.push(result);
      }

      return results;
    });
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
