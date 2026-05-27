import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { UserQuotaUsage } from '../entities/user-quota-usage.entity';
import { QuotaDefinitionService } from './quota-definition.service';
import { UserTier, QuotaResetPeriod } from '../rate-limiting.constants';
import { QuotaStatusDto } from '../dto/quota.dto';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: { minute: number; hour: number; day: number };
  limit: { minute: number; hour: number; day: number };
  retryAfter?: number; // seconds
}

@Injectable()
export class QuotaTrackingService {
  private readonly logger = new Logger(QuotaTrackingService.name);

  constructor(
    @InjectRepository(UserQuotaUsage)
    private readonly usageRepo: Repository<UserQuotaUsage>,
    private readonly definitionService: QuotaDefinitionService,
  ) {}

  /**
   * Atomically increment the user's counters and check if they are within quota.
   * Returns allowed=false if any window is exhausted.
   */
  async checkAndIncrement(userId: string, tier: UserTier): Promise<QuotaCheckResult> {
    const limits = await this.definitionService.resolveForUser(userId, tier);
    const now = new Date();

    const [minute, hour, day] = await Promise.all([
      this.getOrCreateUsage(userId, tier, 'MINUTELY', now),
      this.getOrCreateUsage(userId, tier, 'HOURLY', now),
      this.getOrCreateUsage(userId, tier, 'DAILY', now),
    ]);

    const withinMinute = minute.count < limits.requestsPerMinute;
    const withinHour = hour.count < limits.requestsPerHour;
    const withinDay = day.count < limits.requestsPerDay;
    const allowed = withinMinute && withinHour && withinDay;

    if (allowed) {
      // Increment all windows atomically
      await Promise.all([
        this.usageRepo.increment({ id: minute.id }, 'count', 1),
        this.usageRepo.increment({ id: hour.id }, 'count', 1),
        this.usageRepo.increment({ id: day.id }, 'count', 1),
      ]);
    } else {
      this.logger.warn(
        `Quota exceeded userId=${userId} tier=${tier} ` +
          `min=${minute.count}/${limits.requestsPerMinute} ` +
          `hr=${hour.count}/${limits.requestsPerHour} ` +
          `day=${day.count}/${limits.requestsPerDay}`,
      );
    }

    // retryAfter = seconds until the tightest exhausted window resets
    let retryAfter: number | undefined;
    if (!allowed) {
      const exhausted: Date[] = [];
      if (!withinMinute) exhausted.push(minute.windowEnd);
      if (!withinHour) exhausted.push(hour.windowEnd);
      if (!withinDay) exhausted.push(day.windowEnd);
      const earliest = exhausted.sort((a, b) => a.getTime() - b.getTime())[0];
      retryAfter = Math.ceil((earliest.getTime() - now.getTime()) / 1000);
    }

    return {
      allowed,
      remaining: {
        minute: Math.max(0, limits.requestsPerMinute - minute.count - (allowed ? 1 : 0)),
        hour: Math.max(0, limits.requestsPerHour - hour.count - (allowed ? 1 : 0)),
        day: Math.max(0, limits.requestsPerDay - day.count - (allowed ? 1 : 0)),
      },
      limit: {
        minute: limits.requestsPerMinute,
        hour: limits.requestsPerHour,
        day: limits.requestsPerDay,
      },
      retryAfter,
    };
  }

  /** Get quota status without incrementing (for status endpoint). */
  async getStatus(userId: string, tier: UserTier): Promise<QuotaStatusDto> {
    const limits = await this.definitionService.resolveForUser(userId, tier);
    const now = new Date();

    const [minute, hour, day] = await Promise.all([
      this.getOrCreateUsage(userId, tier, 'MINUTELY', now),
      this.getOrCreateUsage(userId, tier, 'HOURLY', now),
      this.getOrCreateUsage(userId, tier, 'DAILY', now),
    ]);

    return {
      userId,
      tier,
      minuteUsed: minute.count,
      minuteLimit: limits.requestsPerMinute,
      hourUsed: hour.count,
      hourLimit: limits.requestsPerHour,
      dayUsed: day.count,
      dayLimit: limits.requestsPerDay,
      isBlocked: minute.isBlocked || hour.isBlocked || day.isBlocked,
      nextResetAt: minute.windowEnd, // smallest window resets first
    };
  }

  /** Reset all usage rows for a user (or a specific period). */
  async resetUser(userId: string, period?: QuotaResetPeriod): Promise<void> {
    const where = period ? { userId, period } : { userId };
    await this.usageRepo.delete(where);
    this.logger.log(`Quota reset for userId=${userId} period=${period ?? 'ALL'}`);
  }

  /** Called by the scheduler — deletes expired windows so they're recreated fresh. */
  async resetExpiredWindows(period: QuotaResetPeriod): Promise<number> {
    const result = await this.usageRepo.delete({
      period,
      windowEnd: LessThan(new Date()),
    });
    const deleted = result.affected ?? 0;
    if (deleted > 0) {
      this.logger.log(`Reset ${deleted} expired ${period} quota windows`);
    }
    return deleted;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async getOrCreateUsage(
    userId: string,
    tier: UserTier,
    period: QuotaResetPeriod,
    now: Date,
  ): Promise<UserQuotaUsage> {
    const existing = await this.usageRepo.findOne({ where: { userId, period } });

    // If exists and window is still valid, return it
    if (existing && existing.windowEnd > now) {
      return existing;
    }

    // Window expired — delete old and create fresh
    if (existing) {
      await this.usageRepo.delete({ id: existing.id });
    }

    const { windowStart, windowEnd } = this.computeWindow(period, now);
    const usage = this.usageRepo.create({
      userId,
      tier,
      period,
      count: 0,
      windowStart,
      windowEnd,
      isBlocked: false,
    });
    return this.usageRepo.save(usage);
  }

  private computeWindow(
    period: QuotaResetPeriod,
    now: Date,
  ): { windowStart: Date; windowEnd: Date } {
    const windowStart = new Date(now);
    const windowEnd = new Date(now);

    if (period === 'MINUTELY') {
      windowStart.setSeconds(0, 0);
      windowEnd.setSeconds(59, 999);
    } else if (period === 'HOURLY') {
      windowStart.setMinutes(0, 0, 0);
      windowEnd.setMinutes(59, 59, 999);
    } else {
      // DAILY
      windowStart.setHours(0, 0, 0, 0);
      windowEnd.setHours(23, 59, 59, 999);
    }

    return { windowStart, windowEnd };
  }
}
