import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationTemplatesService } from './notification-templates.service';
import { PreferencesService } from './preferences/preferences.service';
import { Notification } from './entities/notification.entity';
import { NotificationPreferences } from './entities/notification-preferences.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreferences]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationTemplatesService,
    PreferencesService,
  ],
  exports: [NotificationsService, PreferencesService],
})
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
