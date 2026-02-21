import { Module } from '@nestjs/common';
import { RateLimitingService } from '../rate-limiting.service';
import { ThrottlingService } from './throttling.service';
import { QuotaManagementService } from './quota.service';
import { AdaptiveRateLimitingService } from './adaptive-rate-limiting.service';
import { DistributedLimiterService } from './distrubutes.service';

@Module({
  providers: [
    RateLimitingService,
    ThrottlingService,
    QuotaManagementService,
    AdaptiveRateLimitingService,
    DistributedLimiterService,
  ],
  exports: [RateLimitingService],
})
export class RateLimitingModule {}