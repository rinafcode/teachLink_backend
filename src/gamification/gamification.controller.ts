import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { PointsService } from './points/points.service';
import { BadgesService } from './badges/badges.service';
import { LeaderboardService } from './leaderboards/leaderboards.service';
import { ChallengesService } from './challenges/challenges.service';

@Controller('gamification')
export class GamificationController {
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly pointsService: PointsService,
    private readonly badgesService: BadgesService,
    private readonly leaderboardService: LeaderboardService,
    private readonly challengesService: ChallengesService,
  ) {}

  @Get('progress/:userId')
  async getProgress(@Param('userId') userId: string) {
    return this.pointsService.getUserProgress(userId);
  }

  @Get('badges/:userId')
  async getBadges(@Param('userId') userId: string) {
    return this.badgesService.getUserBadges(userId);
  }

  @Get('challenges/:userId')
  async getChallenges(@Param('userId') userId: string) {
    return this.challengesService.getUserChallenges(userId);
  }

  @Get('leaderboard')
  async getLeaderboard(@Query('limit') limit?: number) {
    return this.leaderboardService.getTopPlayers(limit);
  }

  @Post('activity/:userId')
  async recordActivity(
    @Param('userId') userId: string,
    @Body('type') type: string,
    @Body('points') points?: number,
  ) {
    return this.gamificationService.handleActivity(userId, type, points);
  }
}
