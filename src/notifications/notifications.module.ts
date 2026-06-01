import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationPreferences } from './entities/notification-preferences.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PreferencesService } from './preferences/preferences.service';
import { NotificationsQueueService } from './notifications.queue';
import { NotificationTemplateService } from './templates/notification-template.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreferences, NotificationTemplate]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PreferencesService,
    NotificationsQueueService,
    NotificationTemplateService,
  ],
  exports: [NotificationsService, PreferencesService, NotificationTemplateService],
})
export class NotificationsModule implements OnModuleInit {
  constructor(private readonly templateService: NotificationTemplateService) {}

  async onModuleInit(): Promise<void> {
    await this.templateService.seedDefaultTemplates();
  }
}
