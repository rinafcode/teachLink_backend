import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
    private readonly dataSource: DataSource,
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
   * FIXES (Issue #1001):
   * - Lost-update race: replaced JS read-modify-write with atomic SQL increment
   *   (totalPoints = totalPoints + :points, xp = xp + :xp)
   * - Atomicity: PointTransaction insert and aggregate update wrapped in single
   *   database transaction via QueryRunner
   * - First-award race: upsert prevents duplicate progress rows when two
   *   concurrent first awards race to create UserProgress
   *
   * @param userId - The user receiving the points
   * @param points - Number of points to award (must be > 0)
   * @param activityType - Description for the transaction ledger
   * @returns Updated progress and tier promotion flag
   */
  async addPoints(
    userId: string,
    points: number,
    activityType: string,
  ): Promise<{ progress: UserProgress; tierPromoted: boolean }> {
    // Use QueryRunner for explicit transaction control spanning both writes
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // STEP 1: Upsert UserProgress atomically via INSERT ... ON CONFLICT DO UPDATE
      // Handles first-award case: if row doesn't exist, insert with initial values.
      // If it exists, increment atomically via SQL arithmetic (no JS mutations).
      // This prevents lost updates when concurrent addPoints() calls race.
      const upsertResult = await queryRunner.manager.query(
        `
        INSERT INTO user_progress ("userId", "totalPoints", xp, level, tier)
        VALUES ($1, $2, $2, 1, $3)
        ON CONFLICT ("userId")
        DO UPDATE SET
          "totalPoints" = user_progress."totalPoints" + $2,
          xp = user_progress.xp + $2
        RETURNING *
        `,
        [userId, points, Tier.BRONZE],
      );

      const updatedProgress: UserProgress = upsertResult[0];

      // STEP 2: Insert PointTransaction ledger row inside the SAME transaction
      // This ensures the transaction is recorded atomically with the aggregate.
      await queryRunner.manager.insert(PointTransaction, {
        user: { id: userId } as User,
        points,
        activityType,
        createdAt: new Date(),
      });

      // The upsert leaves tier untouched on update, so the returned row still
      // carries the tier persisted before this award. Capture it so we can
      // detect a real boundary crossing after the commit.
      const previousTier = updatedProgress.tier ?? Tier.BRONZE;

      // STEP 3: Compute derived fields (level, tier) post-upsert.
      // Note: level is still computed in application layer and could be
      // moved to a trigger in future optimization.
      const newLevel = Math.floor(updatedProgress.xp / 1000) + 1;
      const newTier = this.tiersService.getTierForPoints(updatedProgress.totalPoints);

      // Persist derived fields inside the SAME transaction so points, level and
      // tier all commit together.
      await queryRunner.manager.update(
        UserProgress,
        { user: { id: userId } },
        { level: newLevel, tier: newTier },
      );

      // Reflect the persisted values on the object returned to the caller.
      updatedProgress.level = newLevel;
      updatedProgress.tier = newTier;

      // Commit both writes atomically
      await queryRunner.commitTransaction();

      // tierPromoted is true only when the boundary is actually crossed and the
      // value is now durable in the database.
      const tierPromoted = newTier !== previousTier;

      // STEP 4: Emit event after successful commit
      // Event subscribers (e.g., BadgesService) can now read consistent state
      this.eventEmitter.emit(
        GAMIFICATION_EVENTS.POINTS_AWARDED,
        new PointsAwardedEvent(userId, updatedProgress.totalPoints, updatedProgress.level),
      );

      return {
        progress: updatedProgress,
        tierPromoted,
      };
    } catch (error) {
      // Rollback BOTH writes (upsert + transaction ledger) on any failure
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Always release the connection back to the pool
      await queryRunner.release();
    }
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
