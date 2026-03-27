import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email/email.service';
import { EmailProcessor } from './email/email.processor';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  providers: [NotificationsService, EmailService, EmailProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
