import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { UserQuotaUsage } from '../entities/user-quota-usage.entity';
import { QuotaDefinitionService } from './quota-definition.service';
import { AdaptiveRateLimitingService } from './adaptive-rate-limiting.service';
import { UserTier, QuotaResetPeriod } from '../rate-limiting.constants';
import { QuotaStatusDto } from '../dto/quota.dto';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: { minute: number; hour: number; day: number };
  limit: { minute: number; hour: number; day: number };
  retryAfter?: number;
}

@Injectable()
export class QuotaTrackingService {
  private readonly logger = new Logger(QuotaTrackingService.name);

  constructor(
    @InjectRepository(UserQuotaUsage)
    private readonly usageRepo: Repository<UserQuotaUsage>,
    private readonly definitionService: QuotaDefinitionService,
    private readonly adaptive: AdaptiveRateLimitingService,
  ) {}

  /**
   * Atomically increment the user's counters and check if they are within quota.
   * Returns allowed=false if any window is exhausted or the user is blocked from overage.
   */
  async checkAndIncrement(userId: string, tier: UserTier): Promise<QuotaCheckResult> {
    const baseLimits = await this.definitionService.resolveForUser(userId, tier);
    const [requestsPerMinute, requestsPerHour, requestsPerDay] = await Promise.all([
      this.adaptive.adjustLimit(baseLimits.requestsPerMinute),
      this.adaptive.adjustLimit(baseLimits.requestsPerHour),
      this.adaptive.adjustLimit(baseLimits.requestsPerDay),
    ]);
    const limits = {
      requestsPerMinute,
      requestsPerHour,
      requestsPerDay,
    };
    const now = new Date();

    const minute = await this.getOrCreateUsage(userId, tier, 'MINUTELY', now);
    const hour = await this.getOrCreateUsage(userId, tier, 'HOURLY', now);
    const day = await this.getOrCreateUsage(userId, tier, 'DAILY', now);

    if (this.isBlockedInWindow(minute, hour, day, now)) {
      return this.buildDeniedResult(minute, hour, day, limits, now);
    }

    const withinMinute = minute.count < limits.requestsPerMinute;
    const withinHour = hour.count < limits.requestsPerHour;
    const withinDay = day.count < limits.requestsPerDay;
    const allowed = withinMinute && withinHour && withinDay;

    if (allowed) {
      await Promise.all([
        this.usageRepo.increment({ id: minute.id }, 'count', 1),
        this.usageRepo.increment({ id: hour.id }, 'count', 1),
        this.usageRepo.increment({ id: day.id }, 'count', 1),
      ]);
    } else {
      await this.markOverage({ minute, hour, day }, { withinMinute, withinHour, withinDay });
      this.logger.warn(
        `Quota exceeded identifier=${userId} tier=${tier} ` +
          `min=${minute.count}/${limits.requestsPerMinute} ` +
          `hr=${hour.count}/${limits.requestsPerHour} ` +
          `day=${day.count}/${limits.requestsPerDay}`,
      );
      return this.buildDeniedResult(minute, hour, day, limits, now);
    }

    return {
      allowed: true,
      remaining: {
        minute: Math.max(0, limits.requestsPerMinute - minute.count - 1),
        hour: Math.max(0, limits.requestsPerHour - hour.count - 1),
        day: Math.max(0, limits.requestsPerDay - day.count - 1),
      },
      limit: {
        minute: limits.requestsPerMinute,
        hour: limits.requestsPerHour,
        day: limits.requestsPerDay,
      },
    };
  }

  /** Get quota status without incrementing (for status endpoint). */
  async getStatus(userId: string, tier: UserTier): Promise<QuotaStatusDto> {
    const baseLimits = await this.definitionService.resolveForUser(userId, tier);
    const [requestsPerMinute, requestsPerHour, requestsPerDay] = await Promise.all([
      this.adaptive.adjustLimit(baseLimits.requestsPerMinute),
      this.adaptive.adjustLimit(baseLimits.requestsPerHour),
      this.adaptive.adjustLimit(baseLimits.requestsPerDay),
    ]);
    const limits = {
      requestsPerMinute,
      requestsPerHour,
      requestsPerDay,
    };
    const now = new Date();

    const minute = await this.getOrCreateUsage(userId, tier, 'MINUTELY', now);
    const hour = await this.getOrCreateUsage(userId, tier, 'HOURLY', now);
    const day = await this.getOrCreateUsage(userId, tier, 'DAILY', now);

    return {
      userId,
      tier,
      minuteUsed: minute.count,
      minuteLimit: limits.requestsPerMinute,
      hourUsed: hour.count,
      hourLimit: limits.requestsPerHour,
      dayUsed: day.count,
      dayLimit: limits.requestsPerDay,
      isBlocked: this.isBlockedInWindow(minute, hour, day, now),
      nextResetAt: this.earliestReset(minute, hour, day),
    };
  }

  /** Reset all usage rows for a user (or a specific period). */
  async resetUser(userId: string, period?: QuotaResetPeriod): Promise<void> {
    const where = period ? { userId, period } : { userId };
    await this.usageRepo.delete(where);
    this.logger.log(`Quota reset for identifier=${userId} period=${period ?? 'ALL'}`);
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

  private isBlockedInWindow(
    minute: UserQuotaUsage,
    hour: UserQuotaUsage,
    day: UserQuotaUsage,
    now: Date,
  ): boolean {
    return [minute, hour, day].some((window) => window.isBlocked && window.windowEnd > now);
  }

  private async markOverage(
    windows: { minute: UserQuotaUsage; hour: UserQuotaUsage; day: UserQuotaUsage },
    within: { withinMinute: boolean; withinHour: boolean; withinDay: boolean },
  ): Promise<void> {
    const ids: string[] = [];
    if (!within.withinMinute) ids.push(windows.minute.id);
    if (!within.withinHour) ids.push(windows.hour.id);
    if (!within.withinDay) ids.push(windows.day.id);

    if (ids.length === 0) return;
    await this.usageRepo.update({ id: In(ids) }, { isBlocked: true });
  }

  private buildDeniedResult(
    minute: UserQuotaUsage,
    hour: UserQuotaUsage,
    day: UserQuotaUsage,
    limits: { requestsPerMinute: number; requestsPerHour: number; requestsPerDay: number },
    now: Date,
  ): QuotaCheckResult {
    const withinMinute = minute.count < limits.requestsPerMinute;
    const withinHour = hour.count < limits.requestsPerHour;
    const withinDay = day.count < limits.requestsPerDay;

    const exhausted: Date[] = [];
    if (!withinMinute || minute.isBlocked) exhausted.push(minute.windowEnd);
    if (!withinHour || hour.isBlocked) exhausted.push(hour.windowEnd);
    if (!withinDay || day.isBlocked) exhausted.push(day.windowEnd);
    const earliest = exhausted.sort((a, b) => a.getTime() - b.getTime())[0];
    const retryAfter = Math.max(1, Math.ceil((earliest.getTime() - now.getTime()) / 1000));

    return {
      allowed: false,
      remaining: {
        minute: Math.max(0, limits.requestsPerMinute - minute.count),
        hour: Math.max(0, limits.requestsPerHour - hour.count),
        day: Math.max(0, limits.requestsPerDay - day.count),
      },
      limit: {
        minute: limits.requestsPerMinute,
        hour: limits.requestsPerHour,
        day: limits.requestsPerDay,
      },
      retryAfter,
    };
  }

  private earliestReset(...windows: UserQuotaUsage[]): Date {
    const earliestMs = Math.min(...windows.map((window) => window.windowEnd.getTime()));
    return new Date(earliestMs);
  }

  private async getOrCreateUsage(
    userId: string,
    tier: UserTier,
    period: QuotaResetPeriod,
    now: Date,
  ): Promise<UserQuotaUsage> {
    const existing = await this.usageRepo.findOne({ where: { userId, period } });

    if (existing && existing.windowEnd > now) {
      return existing;
    }

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
      windowEnd.setMinutes(windowEnd.getMinutes() + 1, 0, -1);
    } else if (period === 'HOURLY') {
      windowStart.setMinutes(0, 0, 0);
      windowEnd.setHours(windowEnd.getHours() + 1, 0, 0, -1);
    } else {
      windowStart.setHours(0, 0, 0, 0);
      windowEnd.setDate(windowEnd.getDate() + 1);
      windowEnd.setHours(0, 0, 0, -1);
    }

    return { windowStart, windowEnd };
  }
}
