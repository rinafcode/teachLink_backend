import { Injectable } from '@nestjs/common';
import { PointsService } from './points/points.service';
import { BadgesService } from './badges/badges.service';
import { ChallengesService } from './challenges/challenges.service';

@Injectable()
export class GamificationService {
  constructor(
    private pointsService: PointsService,
    private badgesService: BadgesService,
    private challengesService: ChallengesService,
  ) {}

  async handleActivity(userId: string, activityType: string, points: number = 10) {
    // 1. Add points
    const progress = await this.pointsService.addPoints(userId, points, activityType);

    // 2. Check for badge awarding (simple example: award badge if points > 500)
    if (progress.totalPoints >= 500) {
      // Assuming a badge with ID 'early-achiever' exists
      // await this.badgesService.awardBadge(userId, 'early-achiever-id');
    }

    // 3. Update active challenges based on activity
    // This would normally involve complex logic to match activityType to challenge goals
    
    return progress;
  }
}
