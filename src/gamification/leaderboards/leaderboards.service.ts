import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProgress } from '../entities/user-progress.entity';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(UserProgress)
    private userProgressRepository: Repository<UserProgress>,
  ) {}

  async getTopPlayers(limit: number = 10) {
    return await this.userProgressRepository.find({
      order: { totalPoints: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  async getUserRank(userId: string) {
    const allProgress = await this.userProgressRepository.find({
      order: { totalPoints: 'DESC' },
    });

    const rank = allProgress.findIndex((p) => p.user?.id === userId) + 1;
    return rank > 0 ? rank : null;
  }
}
