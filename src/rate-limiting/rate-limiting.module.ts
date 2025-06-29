import { Module } from '@nestjs/common';
import { RateLimitingService } from './rate-limiting.service';
import { ThrottlingService } from './throttling/throttling.service';
import { QuotaManagementService } from './quota/quota-management.service';
import { AdaptiveRateLimitingService } from './adaptive/adaptive-rate-limiting.service';
import { DistributedLimiterService } from './distributed/distributed-limiter.service';

@Module({
  providers: [
    RateLimitingService,
    ThrottlingService,
    QuotaManagementService,
    AdaptiveRateLimitingService,
    DistributedLimiterService,
  ],
  exports: [
    RateLimitingService,
    ThrottlingService,
    QuotaManagementService,
    AdaptiveRateLimitingService,
    DistributedLimiterService,
  ],
})
export class RateLimitingModule {}
