import { Module } from '@nestjs/common';

import { GamificationController } from './gamification.controller';
import { BadgesService } from './badges/badges.service';
import { PointsService } from './points/points.service';
import { LeaderboardsService } from './leaderboards/leaderboards.service';
import { ChallengesService } from './challenges/challenges.service';
import { LevelsService } from './levels/levels.service';
import { GamificationService } from './gamification.service';

@Module({
  controllers: [GamificationController],
  providers: [
    GamificationService,
    BadgesService,
    PointsService,
    LeaderboardsService,
    ChallengesService,
    LevelsService,
  ],
  exports: [GamificationService],
})
export class GamificationModule {}
