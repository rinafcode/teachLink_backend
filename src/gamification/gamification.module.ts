import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointTransaction } from './entities/point-transaction.entity';
import { UserProgress } from './entities/user-progress.entity';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { Challenge } from './entities/challenge.entity';
import { UserChallenge } from './entities/user-challenge.entity';
import { PointsService } from './points/points.service';
import { BadgesService } from './badges/badges.service';
import { LeaderboardService } from './leaderboards/leaderboards.service';
import { ChallengesService } from './challenges/challenges.service';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PointTransaction,
      UserProgress,
      Badge,
      UserBadge,
      Challenge,
      UserChallenge,
    ]),
  ],
  providers: [
    PointsService,
    BadgesService,
    LeaderboardService,
    ChallengesService,
    GamificationService,
  ],
  controllers: [GamificationController],
  exports: [GamificationService, PointsService, BadgesService, ChallengesService],
})
export class GamificationModule {}
