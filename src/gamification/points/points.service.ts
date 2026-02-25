import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProgress } from '../entities/user-progress.entity';
import { PointTransaction } from '../entities/point-transaction.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(UserProgress)
    private userProgressRepository: Repository<UserProgress>,
    @InjectRepository(PointTransaction)
    private pointTransactionRepository: Repository<PointTransaction>,
  ) {}

  async addPoints(userId: string, points: number, activityType: string) {
    // Log the transaction
    const transaction = this.pointTransactionRepository.create({
      user: { id: userId } as User,
      points,
      activityType,
    });
    await this.pointTransactionRepository.save(transaction);

    // Update user progress
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

    // Basic level progression logic: level up every 1000 XP
    const newLevel = Math.floor(progress.xp / 1000) + 1;
    if (newLevel > progress.level) {
      progress.level = newLevel;
      // TODO: Emit level up event
    }

    return await this.userProgressRepository.save(progress);
  }

  async getUserProgress(userId: string) {
    return await this.userProgressRepository.findOne({
      where: { user: { id: userId } },
    });
  }
}
