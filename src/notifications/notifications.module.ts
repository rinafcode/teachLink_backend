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

@Module({})
export class NotificationsModule {}
