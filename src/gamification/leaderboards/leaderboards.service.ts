import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProgress } from '../entities/user-progress.entity';
import { UserBadge } from '../entities/user-badge.entity';
import { BadgeCategory } from '../enums/badge-category.enum';
import { Tier } from '../enums/tier.enum';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  totalPoints: number;
  level: number;
  badgeCount: number;
}

export interface BadgeLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  badgeCount: number;
  category?: BadgeCategory;
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
    @InjectRepository(UserBadge)
    private userBadgeRepository: Repository<UserBadge>,
  ) {}

  // ─── Points Leaderboard ───────────────────────────────────────────────────

  async getTopPlayers(limit: number = 10): Promise<LeaderboardEntry[]> {
    const rows = await this.userProgressRepository
      .createQueryBuilder('up')
      .innerJoinAndSelect('up.user', 'user')
      .orderBy('up.totalPoints', 'DESC')
      .take(limit)
      .getMany();

    return rows.map((up, index) => ({
      rank: index + 1,
      userId: up.user.id,
      username: up.user.username ?? up.user.email,
      totalPoints: up.totalPoints,
      level: up.level,
      badgeCount: 0, // enriched below if needed
    }));
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
      .innerJoin('up.user', 'user')
      .where('up.totalPoints > (SELECT total_points FROM user_progress WHERE user_id = :userId)', { userId })
      .getCount();

    return count + 1;
  }

  // ─── Badge Leaderboard ────────────────────────────────────────────────────

  async getBadgeLeaderboard(
    limit: number = 10,
    category?: BadgeCategory,
  ): Promise<BadgeLeaderboardEntry[]> {
    const qb = this.userBadgeRepository
      .createQueryBuilder('ub')
      .innerJoin('ub.user', 'user')
      .select('user.id', 'userId')
      .addSelect('user.username', 'username')
      .addSelect('user.email', 'email')
      .addSelect('COUNT(ub.id)', 'badgeCount')
      .groupBy('user.id')
      .addGroupBy('user.username')
      .addGroupBy('user.email')
      .orderBy('badgeCount', 'DESC')
      .limit(limit);

    if (category) {
      qb.innerJoin('ub.badge', 'badge').andWhere('badge.category = :category', { category });
    }

    const rows = await qb.getRawMany();
    return rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      username: row.username ?? row.email,
      badgeCount: parseInt(row.badgeCount, 10),
      category,
    }));
  }

  async getUserBadgeRank(userId: string, category?: BadgeCategory): Promise<number | null> {
    const userCount = await this.userBadgeRepository
      .createQueryBuilder('ub')
      .where('ub.user_id = :userId', { userId })
      .getCount();

    const qb = this.userBadgeRepository
      .createQueryBuilder('ub')
      .select('ub.user_id', 'userId')
      .addSelect('COUNT(ub.id)', 'badgeCount')
      .groupBy('ub.user_id')
      .having('COUNT(ub.id) > :userCount', { userCount });

    if (category) {
      qb.innerJoin('ub.badge', 'badge').andWhere('badge.category = :category', { category });
    }

    const ahead = await qb.getRawMany();
    return ahead.length + 1;
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
