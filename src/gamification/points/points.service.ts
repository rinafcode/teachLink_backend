import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserProgress } from '../entities/user-progress.entity';
import { PointTransaction } from '../entities/point-transaction.entity';
import { User } from '../../users/entities/user.entity';
import { GAMIFICATION_EVENTS, PointsAwardedEvent } from '../events/gamification.events';
import { TiersService } from '../tiers/tiers.service';
import { PointActivityType, POINT_RULES } from '../enums/point-activity.enum';
import { Tier } from '../enums/tier.enum';

// /** Points per XP level (level = floor(xp / XP_PER_LEVEL) + 1) */
// const XP_PER_LEVEL = 1000;

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(UserProgress)
    private userProgressRepository: Repository<UserProgress>,
    @InjectRepository(PointTransaction)
    private pointTransactionRepository: Repository<PointTransaction>,
    private eventEmitter: EventEmitter2,
    private tiersService: TiersService,
  ) {}

  /**
   * Award points for a known activity type using the defined point rules.
   * Returns the updated progress and whether a tier promotion occurred.
   */
  async awardActivity(
    userId: string,
    activityType: PointActivityType,
  ): Promise<{ progress: UserProgress; tierPromoted: boolean }> {
    const points = POINT_RULES[activityType];
    return this.addPoints(userId, points, activityType);
  }

  /**
   * Award an arbitrary number of points for a custom activity string.
   * Returns the updated progress and whether a tier promotion occurred.
   *
   * Issue #1000 — tier computation and persistence ordering fix:
   *  1. `previousTier` is captured from the loaded entity before any mutation.
   *  2. `newTier` is derived from the projected `totalPoints` BEFORE save,
   *     then assigned to `progress.tier` so a single `save()` call persists
   *     both the new point total and the correct tier atomically.
   *  3. The POINTS_AWARDED event is emitted only after `save()` resolves, so
   *     a rolled-back or failed write never publishes a phantom promotion.
   */
  async addPoints(
    userId: string,
    points: number,
    activityType: string,
  ): Promise<{ progress: UserProgress; tierPromoted: boolean }> {
    const transaction = this.pointTransactionRepository.create({
      user: { id: userId } as User,
      points,
      activityType,
    });
    await this.pointTransactionRepository.save(transaction);

    let progress = await this.userProgressRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!progress) {
      progress = this.userProgressRepository.create({
        user: { id: userId } as User,
        totalPoints: 0,
        level: 1,
        xp: 0,
      });
    }

    // Capture the tier currently on the record before any mutation so we can
    // detect a real boundary crossing after the save commits.
    const previousTier = progress.tier ?? Tier.BRONZE;

    progress.totalPoints += points;
    progress.xp += points;
    progress.level = Math.floor(progress.xp / 1000) + 1;

    // Derive the new tier from the projected total and assign it BEFORE save
    // so the single repository call persists both points and tier together.
    const newTier = this.tiersService.getTierForPoints(progress.totalPoints);
    progress.tier = newTier;

    const saved = await this.userProgressRepository.save(progress);

    // tierPromoted is true only when the boundary is actually crossed and the
    // value is now durable in the database.
    const tierPromoted = newTier !== previousTier;

    // Emit only after the DB write succeeds so a save failure does not
    // publish a promotion that never actually committed.
    this.eventEmitter.emit(
      GAMIFICATION_EVENTS.POINTS_AWARDED,
      new PointsAwardedEvent(userId, saved.totalPoints, saved.level),
    );

    return { progress: saved, tierPromoted };
  }

  async getUserProgress(userId: string): Promise<UserProgress | null> {
    return this.userProgressRepository.findOne({
      where: { user: { id: userId } },
    });
  }

  async getPointHistory(userId: string): Promise<PointTransaction[]> {
    return this.pointTransactionRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
