import { Injectable } from '@nestjs/common';
import { PointsService } from './points/points.service';
import { BadgesService } from './badges/badges.service';
import { LeaderboardsService } from './leaderboards/leaderboards.service';
import { ChallengesService } from './challenges/challenges.service';
import { LevelsService } from './levels/levels.service';

@Injectable()
export class GamificationService {
  constructor(
    private readonly pointsService: PointsService,
    private readonly badgesService: BadgesService,
    private readonly leaderboardsService: LeaderboardsService,
    private readonly challengesService: ChallengesService,
    private readonly levelsService: LevelsService,
  ) {}

  // Example: Award points for an activity
  async awardPoints(userId: string, activity: string, points: number) {
    await this.pointsService.addPoints(userId, points, activity);
    await this.leaderboardsService.updateLeaderboard(userId);
    await this.badgesService.checkAndAwardBadges(userId);
    await this.challengesService.checkAndUpdateChallenges(userId, activity);
    // Optionally, check and update user level
    const totalPoints = await this.pointsService.getUserPoints(userId);
    const level = await this.levelsService.getLevel(totalPoints);
    // You can store or return the level as needed
  }
}
