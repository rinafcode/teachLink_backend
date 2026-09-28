import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { deepLinkRateLimitConfig } from './deep-link.config';
import { DeepLinkController } from './deep-link.controller';
import { DeepLinkService } from './deep-link.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: deepLinkRateLimitConfig.ttlMs,
        limit: deepLinkRateLimitConfig.defaultLimit,
      },
    ]),
  ],
  controllers: [DeepLinkController],
  providers: [DeepLinkService],
})
export class DeepLinkModule {}
