import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from '../gateways/notifications/notifications.gateway';
import { NotificationTemplatesService } from './notification-templates.service';
import { PreferencesService } from './preferences/preferences.service';
import { EmailService } from './email/email.service';
import { EmailProcessor } from './email/email.processor';
import { NotificationsQueueService } from './notifications.queue';
import { Notification } from './entities/notification.entity';
import { NotificationPreferences } from './entities/notification-preferences.entity';

/**
 * Registers the notifications module.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreferences]),
    ConfigModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: '24h' },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.EMAIL,
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationTemplatesService,
    PreferencesService,
    EmailService,
    EmailProcessor,
    NotificationsQueueService,
  ],
  exports: [NotificationsService, PreferencesService],
})
export class NotificationsModule {}

