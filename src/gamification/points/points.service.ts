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

    progress.totalPoints += points;
    progress.xp += points;

    const newLevel = Math.floor(progress.xp / 1000) + 1;
    progress.level = newLevel;

    const previousTier = progress.tier;
    const saved = await this.userProgressRepository.save(progress);
    const newTier = this.tiersService.getTierForPoints(saved.totalPoints);
    saved.tier = newTier;
    const tierPromoted = newTier !== previousTier;

    // Emit event so BadgesService can react
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
