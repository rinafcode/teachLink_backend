import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AchievementsService } from './achievements.service';
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
import { AchievementType } from './entities/achievement.entity';

/**
 * Achievements Controller
 * Handles all achievement-related API endpoints including:
 * - Achievement definitions
 * - Progress tracking
 * - Achievement unlocking
 * - Statistics and leaderboards
 */
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  // =====================================================
  // Achievement Definition Management
  // =====================================================

  /**
   * Create a new achievement
   * POST /achievements
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAchievement(
    @Body() dto: CreateAchievementDto,
  ): Promise<AchievementResponseDto> {
    return this.achievementsService.createAchievement(dto);
  }

  /**
   * Get all achievements
   * GET /achievements
   */
  @Get()
  async getAllAchievements(
    @Query('includeHidden') includeHidden?: string,
  ): Promise<AchievementResponseDto[]> {
    return this.achievementsService.getAllAchievements(includeHidden === 'true');
  }

  /**
   * Get achievements by type
   * GET /achievements/type/:type
   */
  @Get('type/:type')
  async getAchievementsByType(
    @Param('type') type: AchievementType,
  ): Promise<AchievementResponseDto[]> {
    return this.achievementsService.getAchievementsByType(type);
  }

  /**
   * Get a specific achievement
   * GET /achievements/:achievementId
   */
  @Get(':achievementId')
  async getAchievementById(
    @Param('achievementId') achievementId: string,
  ): Promise<AchievementResponseDto> {
    return this.achievementsService.getAchievementById(achievementId);
  }

  /**
   * Update an achievement
   * PUT /achievements/:achievementId
   */
  @Put(':achievementId')
  async updateAchievement(
    @Param('achievementId') achievementId: string,
    @Body() dto: UpdateAchievementDto,
  ): Promise<AchievementResponseDto> {
    return this.achievementsService.updateAchievement(achievementId, dto);
  }

  /**
   * Deactivate an achievement
   * DELETE /achievements/:achievementId
   */
  @Delete(':achievementId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivateAchievement(@Param('achievementId') achievementId: string): Promise<void> {
    return this.achievementsService.deactivateAchievement(achievementId);
  }

  // =====================================================
  // Progress Tracking
  // =====================================================

  /**
   * Initialize progress for a user toward an achievement
   * POST /achievements/:achievementId/progress/:userId
   */
  @Post(':achievementId/progress/:userId')
  @HttpCode(HttpStatus.CREATED)
  async initializeProgress(
    @Param('achievementId') achievementId: string,
    @Param('userId') userId: string,
  ): Promise<AchievementProgressDto> {
    return this.achievementsService.initializeProgress(userId, achievementId);
  }

  /**
   * Get a user's progress toward an achievement
   * GET /achievements/:achievementId/progress/:userId
   */
  @Get(':achievementId/progress/:userId')
  async getUserProgressForAchievement(
    @Param('achievementId') achievementId: string,
    @Param('userId') userId: string,
  ): Promise<AchievementProgressDto> {
    return this.achievementsService.getUserProgressForAchievement(userId, achievementId);
  }

  /**
   * Update a user's progress toward an achievement
   * PUT /achievements/:achievementId/progress/:userId
   */
  @Put(':achievementId/progress/:userId')
  async updateProgress(
    @Param('achievementId') achievementId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateAchievementProgressDto,
  ): Promise<AchievementProgressDto> {
    return this.achievementsService.updateProgress(userId, achievementId, dto);
  }

  /**
   * Increment progress for a user toward an achievement
   * POST /achievements/:achievementId/progress/:userId/increment
   */
  @Post(':achievementId/progress/:userId/increment')
  async incrementProgress(
    @Param('achievementId') achievementId: string,
    @Param('userId') userId: string,
    @Body() body: { incrementBy?: number; metadata?: any },
  ): Promise<AchievementProgressDto> {
    return this.achievementsService.incrementProgress(
      userId,
      achievementId,
      body.incrementBy || 1,
      body.metadata,
    );
  }

  /**
   * Get all progress records for a user
   * GET /achievements/progress/:userId
   */
  @Get('progress/:userId')
  async getUserAllProgress(@Param('userId') userId: string): Promise<AchievementProgressDto[]> {
    return this.achievementsService.getUserAllProgress(userId);
  }

  // =====================================================
  // Achievement Unlocking
  // =====================================================

  /**
   * Unlock an achievement for a user
   * POST /achievements/:achievementId/unlock/:userId
   */
  @Post(':achievementId/unlock/:userId')
  @HttpCode(HttpStatus.CREATED)
  async unlockAchievement(
    @Param('achievementId') achievementId: string,
    @Param('userId') userId: string,
    @Body() body?: { metadata?: any },
  ): Promise<AchievementUnlockedEventDto> {
    return this.achievementsService.unlockAchievement(userId, achievementId, body?.metadata);
  }

  /**
   * Get all unlocked achievements for a user
   * GET /achievements/user/:userId/unlocked
   */
  @Get('user/:userId/unlocked')
  async getUserAchievements(
    @Param('userId') userId: string,
  ): Promise<UserAchievementDto[]> {
    return this.achievementsService.getUserAchievements(userId);
  }

  /**
   * Check if user has an achievement
   * GET /achievements/:achievementId/user/:userId/has
   */
  @Get(':achievementId/user/:userId/has')
  async hasAchievement(
    @Param('achievementId') achievementId: string,
    @Param('userId') userId: string,
  ): Promise<{ hasAchievement: boolean }> {
    const has = await this.achievementsService.hasAchievement(userId, achievementId);
    return { hasAchievement: has };
  }

  /**
   * Get achievement count for a user
   * GET /achievements/user/:userId/count
   */
  @Get('user/:userId/count')
  async getUserAchievementCount(@Param('userId') userId: string): Promise<{ count: number }> {
    const count = await this.achievementsService.getUserAchievementCount(userId);
    return { count };
  }

  // =====================================================
  // Statistics and Analytics
  // =====================================================

  /**
   * Get statistics for an achievement
   * GET /achievements/:achievementId/statistics
   */
  @Get(':achievementId/statistics')
  async getAchievementStatistics(
    @Param('achievementId') achievementId: string,
  ): Promise<AchievementStatisticsDto> {
    return this.achievementsService.getAchievementStatistics(achievementId);
  }

  /**
   * Get achievement overview for a user
   * GET /achievements/user/:userId/overview
   */
  @Get('user/:userId/overview')
  async getUserAchievementOverview(
    @Param('userId') userId: string,
  ): Promise<AchievementOverviewDto> {
    return this.achievementsService.getUserAchievementOverview(userId);
  }

  /**
   * Get achievements leaderboard
   * GET /achievements/leaderboard
   */
  @Get('leaderboard')
  async getAchievementsLeaderboard(
    @Query('limit') limit: string = '10',
  ): Promise<AchievementLeaderboardDto[]> {
    return this.achievementsService.getAchievementsLeaderboard(parseInt(limit, 10));
  }

  /**
   * Get all statistics
   * GET /achievements/statistics/all
   */
  @Get('statistics/all')
  async getAllAchievementsStatistics(): Promise<AchievementStatisticsDto[]> {
    return this.achievementsService.getAllAchievementsStatistics();
  }

  /**
   * Batch unlock achievements
   * POST /achievements/batch-unlock/:userId
   */
  @Post('batch-unlock/:userId')
  @HttpCode(HttpStatus.CREATED)
  async batchUnlockAchievements(
    @Param('userId') userId: string,
    @Body() body: { achievementIds: string[] },
  ): Promise<AchievementUnlockedEventDto[]> {
    return this.achievementsService.batchUnlockAchievements(userId, body.achievementIds);
  }
}
