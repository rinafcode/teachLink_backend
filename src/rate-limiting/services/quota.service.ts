import { Injectable } from '@nestjs/common';
import { QUOTA_LIMITS, UserTier } from '../rate-limiting.constants';
import { QuotaDefinitionService } from './quota-definition.service';
import { QuotaTrackingService } from './quota-tracking.service';
import { AdaptiveRateLimitingService } from './adaptive-rate-limiting.service';

export { UserTier };

/**
 * Facade service — unified entry point for quota operations.
 * Combines definition lookup, tracking, and adaptive adjustment.
 */
@Injectable()
export class QuotaManagementService {
  constructor(
    private readonly definitions: QuotaDefinitionService,
    private readonly tracking: QuotaTrackingService,
    private readonly adaptive: AdaptiveRateLimitingService,
  ) {}

  /** Resolve and return the effective quota limits for a user. */
  async getQuotaForUser(userId: string, tier: UserTier) {
    const base = await this.definitions.resolveForUser(userId, tier);
    const [requestsPerMinute, requestsPerHour, requestsPerDay] = await Promise.all([
      this.adaptive.adjustLimit(base.requestsPerMinute),
      this.adaptive.adjustLimit(base.requestsPerHour),
      this.adaptive.adjustLimit(base.requestsPerDay),
    ]);

    return {
      requestsPerMinute,
      requestsPerHour,
      requestsPerDay,
    };
  }

  /** Legacy helper — kept for backwards compat with existing callers. */
  getQuotaForTier(tier: UserTier) {
    return QUOTA_LIMITS[tier] ?? QUOTA_LIMITS[UserTier.FREE];
  }

  /** Perform a quota check + increment. Delegates to tracking service. */
  async checkAndConsume(userId: string, tier: UserTier) {
    return this.tracking.checkAndIncrement(userId, tier);
  }

  /** Fetch live quota status for a user. */
  async getStatus(userId: string, tier: UserTier) {
    return this.tracking.getStatus(userId, tier);
  }
}
