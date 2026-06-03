import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { UserProgress } from './entities/user-progress.entity';
import { PointTransaction } from './entities/point-transaction.entity';
import { Challenge } from './entities/challenge.entity';
import { UserChallenge } from './entities/user-challenge.entity';

import { BadgesService } from './badges/badges.service';
import { BadgesController } from './badges/badges.controller';
import { PointsService } from './points/points.service';
import { LeaderboardService } from './leaderboards/leaderboards.service';

import { UserProgress } from './entities/user-progress.entity';
import { PointTransaction } from './entities/point-transaction.entity';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { Challenge } from './entities/challenge.entity';
import { UserChallenge } from './entities/user-challenge.entity';
import { TierReward } from './entities/tier-reward.entity';

import { PointsService } from './points/points.service';
import { LeaderboardService } from './leaderboards/leaderboards.service';
import { BadgesService } from './badges/badges.service';
import { TiersService } from './tiers/tiers.service';
import { GamificationController } from './gamification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Badge,
      UserBadge,
      UserProgress,
      PointTransaction,
      Challenge,
      UserChallenge,
    ]),
    EventEmitterModule.forRoot(),
  ],
  controllers: [BadgesController],
  providers: [BadgesService, PointsService, LeaderboardService],
  exports: [BadgesService, PointsService, LeaderboardService],
      UserProgress,
      PointTransaction,
      Badge,
      UserBadge,
      Challenge,
      UserChallenge,
      TierReward,
    ]),
  ],
  controllers: [GamificationController],
  providers: [PointsService, LeaderboardService, BadgesService, TiersService],
  exports: [PointsService, LeaderboardService, BadgesService, TiersService],
})
export class GamificationModule {}
