import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProgress } from '../entities/user-progress.entity';

/**
 * Provides leaderboard operations.
 */
@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(UserProgress)
    private userProgressRepository: Repository<UserProgress>,
  ) {}
  async getTopPlayers(limit: number = 10): Promise<UserProgress[]> {
    return await this.userProgressRepository.find({
      order: { totalPoints: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }
  async getUserRank(userId: string): Promise<number | null> {
    const allProgress = await this.userProgressRepository.find({
      order: { totalPoints: 'DESC' },
    });
    // This is a simple rank calculation that is O(n) over users.
    // For large leaderboards, consider a direct database rank query or a
    // cached materialized ranking field.
    const rank = allProgress.findIndex((p) => p.user?.id === userId) + 1;
    return rank > 0 ? rank : null;
  }
}
