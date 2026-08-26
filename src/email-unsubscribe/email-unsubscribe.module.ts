import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { TIME } from '../common/constants/time.constants';
import { EmailUnsubscribeController } from './email-unsubscribe.controller';
import { EmailUnsubscribeService } from './email-unsubscribe.service';
import { UnsubscribeToken } from './entities/unsubscribe-token.entity';
import { EmailSubscription } from '../email-marketing/entities/email-subscription.entity';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: TIME.ONE_MINUTE_MS,
        limit: 100,
      },
    ]),
    TypeOrmModule.forFeature([UnsubscribeToken, EmailSubscription]),
  ],
  controllers: [EmailUnsubscribeController],
  providers: [EmailUnsubscribeService],
  exports: [EmailUnsubscribeService],
})
export class EmailUnsubscribeModule {}
