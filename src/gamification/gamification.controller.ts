import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PointsService } from './points/points.service';
import { LeaderboardService } from './leaderboards/leaderboards.service';
import { TiersService } from './tiers/tiers.service';
import { PointActivityType } from './enums/point-activity.enum';
import { Tier } from './enums/tier.enum';
import { TierReward } from './entities/tier-reward.entity';

class AwardActivityDto {
  userId: string;
  activityType: PointActivityType;
}

class AddPointsDto {
  userId: string;
  points: number;
  activityType: string;
}

class UpsertRewardDto {
  title: string;
  description: string;
  badgeId?: string;
  bonusPoints?: number;
  metadata?: Record<string, unknown>;
}

@Controller('gamification')
export class GamificationController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly leaderboardService: LeaderboardService,
    private readonly tiersService: TiersService,
  ) {}

  // ── Points ──────────────────────────────────────────────────────────────────

  @Post('points/award-activity')
  @HttpCode(HttpStatus.OK)
  awardActivity(@Body() dto: AwardActivityDto) {
    return this.pointsService.awardActivity(dto.userId, dto.activityType);
  }

  @Post('points/add')
  @HttpCode(HttpStatus.OK)
  addPoints(@Body() dto: AddPointsDto) {
    return this.pointsService.addPoints(dto.userId, dto.points, dto.activityType);
  }

  @Get('points/progress/:userId')
  getUserProgress(@Param('userId') userId: string) {
    return this.pointsService.getUserProgress(userId);
  }

  @Get('points/history/:userId')
  getPointHistory(@Param('userId') userId: string) {
    return this.pointsService.getPointHistory(userId);
  }

  // ── Leaderboard ─────────────────────────────────────────────────────────────

  @Get('leaderboard')
  getLeaderboard(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.leaderboardService.getLeaderboard(page, pageSize);
  }

  @Get('leaderboard/rank/:userId')
  getUserRank(@Param('userId') userId: string) {
    return this.leaderboardService.getUserRank(userId);
  }

  // ── Tiers ───────────────────────────────────────────────────────────────────

  @Get('tiers/rewards')
  getAllRewards(): Promise<TierReward[]> {
    return this.tiersService.getAllRewards();
  }

  @Get('tiers/rewards/:tier')
  getRewardForTier(@Param('tier') tier: Tier) {
    return this.tiersService.getRewardForTier(tier);
  }

  @Post('tiers/rewards/:tier')
  @HttpCode(HttpStatus.OK)
  upsertReward(@Param('tier') tier: Tier, @Body() dto: UpsertRewardDto) {
    return this.tiersService.upsertReward(tier, dto);
  }

  @Get('tiers/next/:userId')
  async getNextTierInfo(@Param('userId') userId: string) {
    const progress = await this.pointsService.getUserProgress(userId);
    if (!progress) return null;
    const nextTier = this.tiersService.getNextTier(progress.tier);
    const pointsNeeded = this.tiersService.pointsToNextTier(progress.totalPoints);
    return { currentTier: progress.tier, nextTier, pointsNeeded };
  }
}
