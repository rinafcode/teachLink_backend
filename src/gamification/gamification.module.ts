import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { OutboxModule } from '../common/events/outbox.module';

import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { UserProgress } from './entities/user-progress.entity';
import { PointTransaction } from './entities/point-transaction.entity';
import { Challenge } from './entities/challenge.entity';
import { UserChallenge } from './entities/user-challenge.entity';
import { TierReward } from './entities/tier-reward.entity';

import { BadgesService } from './badges/badges.service';
import { BadgesController } from './badges/badges.controller';
import { PointsService } from './points/points.service';
import { LeaderboardService } from './leaderboards/leaderboards.service';
import { TiersService } from './tiers/tiers.service';
import { GamificationController } from './gamification.controller';
import { THROTTLE } from '../common/constants/throttle.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserProgress,
      PointTransaction,
      Badge,
      UserBadge,
      Challenge,
      UserChallenge,
      TierReward,
    ]),
    EventEmitterModule.forRoot(),
    OutboxModule,
    // Provides the storage/config CustomThrottleGuard needs to enforce the
    // per-handler @Throttle presets on the badges endpoints. The baseline
    // mirrors the MODERATE preset; sensitive handlers tighten it further.
    ThrottlerModule.forRoot([{ ttl: THROTTLE.MODERATE.ttl, limit: THROTTLE.MODERATE.limit }]),
  ],
  controllers: [GamificationController, BadgesController],
  providers: [PointsService, LeaderboardService, BadgesService, TiersService],
  exports: [PointsService, LeaderboardService, BadgesService, TiersService],
})
export class GamificationModule {}
