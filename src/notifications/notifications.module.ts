import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationPreferencesService } from './preferences/preferences.service';
import { NotificationsController } from './notifications.controller';
import { NotificationDelivery } from './entities/notification-delivery.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, NotificationDelivery])],
  providers: [NotificationsService, NotificationsGateway, NotificationPreferencesService],
  exports: [NotificationsService],
  controllers: [NotificationsController],
})
export class NotificationsModule {} 