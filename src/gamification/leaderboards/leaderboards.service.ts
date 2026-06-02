import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProgress } from '../entities/user-progress.entity';
import { Tier } from '../enums/tier.enum';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username?: string;
  totalPoints: number;
  level: number;
  tier: Tier;
}

export interface PaginatedLeaderboard {
  data: LeaderboardEntry[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(UserProgress)
    private userProgressRepository: Repository<UserProgress>,
  ) {}

  async getLeaderboard(page = 1, pageSize = 20): Promise<PaginatedLeaderboard> {
    const clampedSize = Math.min(pageSize, 100);
    const offset = (page - 1) * clampedSize;

    const [rows, total] = await this.userProgressRepository.findAndCount({
      order: { totalPoints: 'DESC' },
      skip: offset,
      take: clampedSize,
      relations: ['user'],
    });

    const data: LeaderboardEntry[] = rows.map((p, i) => ({
      rank: offset + i + 1,
      userId: p.user?.id,
      username: p.user?.username,
      totalPoints: p.totalPoints,
      level: p.level,
      tier: p.tier,
    }));

    return { data, total, page, pageSize: clampedSize };
  }

  async getUserRank(userId: string): Promise<number | null> {
    const count = await this.userProgressRepository
      .createQueryBuilder('up')
      .innerJoin('up.user', 'u')
      .where('u.id = :userId', { userId })
      .getOne();

    if (!count) return null;

    const rank =
      (await this.userProgressRepository
        .createQueryBuilder('up')
        .where('up.totalPoints > :pts', { pts: count.totalPoints })
        .getCount()) + 1;

    return rank;
  }

  /** @deprecated Use getLeaderboard() for paginated results */
  async getTopPlayers(limit = 10): Promise<UserProgress[]> {
    return this.userProgressRepository.find({
      order: { totalPoints: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }
}
