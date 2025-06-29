import { Injectable } from '@nestjs/common';
import { ThrottlingService } from './throttling/throttling.service';
import { QuotaManagementService } from './quota/quota-management.service';
import { AdaptiveRateLimitingService } from './adaptive/adaptive-rate-limiting.service';
import { DistributedLimiterService } from './distributed/distributed-limiter.service';

@Injectable()
export class RateLimitingService {
  constructor(
    private readonly throttlingService: ThrottlingService,
    private readonly quotaService: QuotaManagementService,
    private readonly adaptiveService: AdaptiveRateLimitingService,
    private readonly distributedService: DistributedLimiterService,
  ) {}

  async isAllowed(userId: string, tier: string, endpoint: string, ip: string): Promise<boolean> {
    // Bypass for premium users
    if (tier === 'premium') return true;
    // Distributed check
    if (!(await this.distributedService.isAllowed(userId, endpoint))) return false;
    // Adaptive check
    if (!(await this.adaptiveService.isAllowed(userId, endpoint))) return false;
    // Quota check
    if (!(await this.quotaService.isAllowed(userId, tier, endpoint))) return false;
    // Throttling (sliding window)
    return this.throttlingService.isAllowed(userId, tier, endpoint, ip);
  }
}
