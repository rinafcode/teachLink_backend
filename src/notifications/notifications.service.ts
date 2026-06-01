import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Notification,
  NotificationStatus,
  NotificationType,
} from './entities/notification.entity';
import { CreateNotificationDto } from './dto/notification.dto';
import { PreferencesService } from './preferences/preferences.service';
import { NotificationsQueueService } from './notifications.queue';
import { NotificationTemplateService } from './templates/notification-template.service';
import { SendTemplatedNotificationDto } from './dto/preferences.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly preferencesService: PreferencesService,
    private readonly queueService: NotificationsQueueService,
    private readonly templateService: NotificationTemplateService,
  ) {}

  async findForUser(userId: string, limit = 50): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({ where: { id, userId } });
    if (!notification) {
      return null;
    }
    notification.isRead = true;
    notification.readAt = new Date();
    return this.notificationRepository.save(notification);
  }

  async markManyRead(ids: string[], userId: string): Promise<void> {
    await this.notificationRepository.update(
      { id: In(ids), userId },
      { isRead: true, readAt: new Date() },
    );
  }

  async create(dto: CreateNotificationDto): Promise<Notification | null> {
    const eventType = (dto.metadata?.eventType as string) || 'general';
    const allowed = await this.shouldDeliver(dto.userId, dto.type ?? NotificationType.IN_APP, eventType);
    if (!allowed) {
      this.logger.debug(`Notification suppressed for user ${dto.userId} event ${eventType}`);
      return null;
    }

    const notification = await this.notificationRepository.save(
      this.notificationRepository.create({
        userId: dto.userId,
        title: dto.title,
        content: dto.content,
        type: dto.type ?? NotificationType.IN_APP,
        priority: dto.priority,
        metadata: dto.metadata,
        status: NotificationStatus.PENDING,
      }),
    );

    await this.dispatchToChannel(notification);
    return notification;
  }

  async sendTemplated(dto: SendTemplatedNotificationDto): Promise<Notification[]> {
    const channels: NotificationType[] = [
      NotificationType.EMAIL,
      NotificationType.PUSH,
      NotificationType.IN_APP,
      NotificationType.SMS,
    ];
    const sent: Notification[] = [];

    for (const channel of channels) {
      const channelKey = this.channelPreferenceKey(channel);
      if (!(await this.preferencesService.isChannelEnabled(dto.userId, channelKey))) {
        continue;
      }
      if (!(await this.shouldDeliver(dto.userId, channel, dto.eventType, dto.frequencyOverride))) {
        continue;
      }

      try {
        const rendered = await this.templateService.renderByName(
          dto.templateName,
          dto.context,
          dto.templateVersion,
          channel,
        );
        const notification = await this.notificationRepository.save(
          this.notificationRepository.create({
            userId: dto.userId,
            title: rendered.subject ?? dto.templateName,
            content: rendered.body,
            type: channel,
            metadata: {
              eventType: dto.eventType,
              templateName: dto.templateName,
              templateVersion: rendered.templateVersion,
            },
            status: NotificationStatus.PENDING,
          }),
        );
        await this.dispatchToChannel(notification);
        sent.push(notification);
      } catch {
        this.logger.debug(`No template for ${dto.templateName} on channel ${channel}`);
      }
    }
    return sent;
  }

  async unsubscribe(userId: string, eventType: string): Promise<void> {
    if (eventType === 'all') {
      await this.preferencesService.updatePreferences(userId, { globalUnsubscribe: true });
      return;
    }
    const prefs = await this.preferencesService.getPreferences(userId);
    const topics = { ...(prefs.topicSubscriptions ?? {}), [eventType]: false };
    const frequency = { ...(prefs.eventFrequency ?? {}), [eventType]: 'never' as const };
    await this.preferencesService.updatePreferences(userId, {
      topicSubscriptions: topics,
      eventFrequency: frequency,
    });
  }

  private async shouldDeliver(
    userId: string,
    type: NotificationType,
    eventType: string,
    frequencyOverride?: 'instant' | 'daily' | 'weekly' | 'never',
  ): Promise<boolean> {
    const prefs = await this.preferencesService.getPreferences(userId);
    if (prefs.globalUnsubscribe) {
      return false;
    }
    if (prefs.topicSubscriptions?.[eventType] === false) {
      return false;
    }
    const frequency = frequencyOverride ?? prefs.eventFrequency?.[eventType] ?? 'instant';
    if (frequency === 'never') {
      return false;
    }
    if (this.isQuietHours(prefs.quietTimeStart, prefs.quietTimeEnd)) {
      return type === NotificationType.IN_APP;
    }
    return true;
  }

  private isQuietHours(start: string, end: string): boolean {
    const now = new Date();
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const minutes = now.getHours() * 60 + now.getMinutes();
    const startM = sh * 60 + (sm || 0);
    const endM = eh * 60 + (em || 0);
    if (startM <= endM) {
      return minutes >= startM && minutes < endM;
    }
    return minutes >= startM || minutes < endM;
  }

  private channelPreferenceKey(
    type: NotificationType,
  ): 'emailEnabled' | 'pushEnabled' | 'inAppEnabled' | 'smsEnabled' {
    const map: Record<NotificationType, 'emailEnabled' | 'pushEnabled' | 'inAppEnabled' | 'smsEnabled'> = {
      [NotificationType.EMAIL]: 'emailEnabled',
      [NotificationType.PUSH]: 'pushEnabled',
      [NotificationType.IN_APP]: 'inAppEnabled',
      [NotificationType.SMS]: 'smsEnabled',
    };
    return map[type];
  }

  private async dispatchToChannel(notification: Notification): Promise<void> {
    switch (notification.type) {
      case NotificationType.IN_APP:
        await this.notificationRepository.update(notification.id, {
          status: NotificationStatus.DELIVERED,
        });
        break;
      case NotificationType.EMAIL:
      case NotificationType.PUSH:
        await this.queueService.publishToTopic(notification);
        break;
      case NotificationType.SMS:
        this.logger.log(`SMS notification queued (optional): ${notification.id}`);
        await this.notificationRepository.update(notification.id, {
          status: NotificationStatus.SENT,
        });
        break;
      default:
        await this.queueService.publishToTopic(notification);
    }
  }
}
