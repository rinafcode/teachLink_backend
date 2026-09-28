import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { UserProgress } from '../entities/user-progress.entity';
import { UserBadge } from '../entities/user-badge.entity';
import { BadgeCategory } from '../enums/badge-category.enum';
import { Tier } from '../enums/tier.enum';
import { REDIS_CLIENT } from '../../common/redis/redis.constants';

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

/**
 * Maximum number of rows a caller may request from a leaderboard.
 *
 * Issue #1159 — a caller-supplied `limit` (e.g. `?limit=1000000`) used to be
 * passed straight into `take()`/`limit()`, forcing a full-table sort and a
 * large response. Any larger value is coerced down to this documented cap.
 */
export const MAX_LEADERBOARD_LIMIT = 100;

/**
 * How long (seconds) a computed top-N leaderboard snapshot is served from
 * Redis before the ordering query is re-run.
 *
 * Issue #1159 — leaderboards are read-heavy and change slowly, so caching the
 * result for a short TTL lets repeated reads skip the sort entirely while
 * keeping staleness bounded. Entries naturally expire on point/badge changes.
 */
export const LEADERBOARD_CACHE_TTL_SECONDS = 60;

const pointsCacheKey = (limit: number) => `cache:leaderboard:points:${limit}`;
const badgeCacheKey = (limit: number, category?: BadgeCategory) =>
  `cache:leaderboard:badges:${category ?? 'all'}:${limit}`;

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    @InjectRepository(UserProgress)
    private userProgressRepository: Repository<UserProgress>,
    @InjectRepository(UserBadge)
    private userBadgeRepository: Repository<UserBadge>,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {}

  // ─── Points Leaderboard ───────────────────────────────────────────────────

  async getTopPlayers(limit: number = 10): Promise<LeaderboardEntry[]> {
    const clampedLimit = this.clampLimit(limit);
    const cacheKey = pointsCacheKey(clampedLimit);

    const cached = await this.getCached<LeaderboardEntry[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const rows = await this.userProgressRepository
      .createQueryBuilder('up')
      .innerJoinAndSelect('up.user', 'user')
      .orderBy('up.totalPoints', 'DESC')
      .take(clampedLimit)
      .getMany();

    const entries: LeaderboardEntry[] = rows.map((up, index) => ({
      rank: index + 1,
      userId: up.user.id,
      username: up.user.username ?? up.user.email,
      totalPoints: up.totalPoints,
      level: up.level,
      badgeCount: 0, // enriched below if needed
    }));

    await this.setCached(cacheKey, entries);
    return entries;
  }

  async getLeaderboard(page = 1, pageSize = 20): Promise<PaginatedLeaderboard> {
    const clampedSize = Math.min(pageSize, MAX_LEADERBOARD_LIMIT);
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
      badgeCount: 0,
    }));

    return { data, total, page, pageSize: clampedSize };
  }

  async getUserRank(userId: string): Promise<number | null> {
    const count = await this.userProgressRepository
      .createQueryBuilder('up')
      .innerJoin('up.user', 'user')
      .where('up.totalPoints > (SELECT total_points FROM user_progress WHERE user_id = :userId)', {
        userId,
      })
      .getCount();

    return count + 1;
  }

  // ─── Badge Leaderboard ────────────────────────────────────────────────────

  async getBadgeLeaderboard(
    limit: number = 10,
    category?: BadgeCategory,
  ): Promise<BadgeLeaderboardEntry[]> {
    const clampedLimit = this.clampLimit(limit);
    const cacheKey = badgeCacheKey(clampedLimit, category);

    const cached = await this.getCached<BadgeLeaderboardEntry[]>(cacheKey);
    if (cached) {
      return cached;
    }

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
      .limit(clampedLimit);

    if (category) {
      qb.innerJoin('ub.badge', 'badge').andWhere('badge.category = :category', { category });
    }

    const rows = await qb.getRawMany();
    const entries: BadgeLeaderboardEntry[] = rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      username: row.username ?? row.email,
      badgeCount: parseInt(row.badgeCount, 10),
      category,
      totalPoints: 0,
      level: 0,
      tier: 'BRONZE' as any,
    }));

    await this.setCached(cacheKey, entries);
    return entries;
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
  }

  // ─── Cache helpers ────────────────────────────────────────────────────────

  /**
   * Coerces a caller-supplied `limit` into the safe range [1, MAX_LEADERBOARD_LIMIT].
   *
   * Non-finite values fall back to the documented maximum so a malformed
   * request can never expand the query into an unbounded full-table sort.
   */
  private clampLimit(limit: number): number {
    if (!Number.isFinite(limit)) {
      return MAX_LEADERBOARD_LIMIT;
    }
    return Math.min(Math.max(Math.floor(limit), 1), MAX_LEADERBOARD_LIMIT);
  }

  /** Reads a JSON-serialized value from Redis. Falls back to a cache miss on any error. */
  private async getCached<T>(key: string): Promise<T | undefined> {
    if (!this.redis) {
      return undefined;
    }
    try {
      const raw = await this.redis.get(key);
      if (!raw) {
        return undefined;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      // A Redis outage must never break leaderboard reads — fall back to the DB.
      this.logger.warn(`Leaderboard cache read failed for ${key}: ${(error as Error).message}`);
      return undefined;
    }
  }

  /** Stores a JSON-serialized value in Redis with the short leaderboard TTL. */
  private async setCached<T>(key: string, value: T): Promise<void> {
    if (!this.redis) {
      return;
    }
    try {
      await this.redis.setex(key, LEADERBOARD_CACHE_TTL_SECONDS, JSON.stringify(value));
    } catch (error) {
      // Failing to populate the cache is non-fatal — the DB result is still returned.
      this.logger.warn(`Leaderboard cache write failed for ${key}: ${(error as Error).message}`);
    }
  }
}
