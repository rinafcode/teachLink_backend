import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailEvent } from './entities/email-event.entity';
import { EmailTrackingService } from './services/email-tracking.service';
import { EmailWebhookController } from './email-webhook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmailEvent])],
  providers: [EmailTrackingService],
  controllers: [EmailWebhookController],
  exports: [EmailTrackingService],
})
export class EmailModule {}
