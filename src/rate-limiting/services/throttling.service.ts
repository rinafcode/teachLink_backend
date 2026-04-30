import { Injectable } from '@nestjs/common';
import { DistributedLimiterService } from './distrubutes.service';
import { QuotaManagementService, UserTier } from './quota.service';
import { AdaptiveRateLimitingService } from './adaptive-rate-limiting.service';

/**
 * Provides throttling operations.
 */
@Injectable()
export class ThrottlingService {
  constructor(
    private readonly distributedLimiter: DistributedLimiterService,
    private readonly quotaService: QuotaManagementService,
    private readonly adaptiveService: AdaptiveRateLimitingService,
  ) {}

  /**
   * Handles request.
   * @param userId The user identifier.
   * @param tier The tier.
   * @param endpoint The endpoint.
   * @returns The operation result.
   */
  async handleRequest(userId: string, tier: UserTier, endpoint: string) {
    if (tier === UserTier.PREMIUM) {
      return; // bypass
    }

    const { limit, window } = this.quotaService.getQuotaForTier(tier);
    const adjustedLimit = this.adaptiveService.adjustLimit(limit);

    const key = `rate:${userId}:${endpoint}`;

    await this.distributedLimiter.slidingWindowCheck(key, adjustedLimit, window);
  }
}
