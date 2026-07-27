import { Injectable, Optional, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { Notification, NotificationType, NotificationStatus } from './entities/notification.entity';
import { PaginationService } from '../common/services/pagination.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreateNotificationDto } from './dto/notification.dto';
import { SendTemplatedNotificationDto } from './dto/preferences.dto';
import { PreferencesService } from './preferences/preferences.service';
import { NotificationTemplateService } from './templates/notification-template.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private readonly preferencesService: PreferencesService,
    private readonly templateService: NotificationTemplateService,
    @Optional()
    private paginationService: PaginationService = new PaginationService(),
  ) {}

  async findDuplicate(userId: string, type: NotificationType, content: string) {
    return this.notificationRepository.findOne({
      where: {
        userId,
        type,
        content,
        createdAt: MoreThan(new Date(Date.now() - 5 * 60 * 1000)),
      },
    });
  }

  async sendNotification(userId: string, type: NotificationType, content: string) {
    const duplicate = await this.findDuplicate(userId, type, content);
    if (duplicate) {
      return duplicate;
    }

    const notification = this.notificationRepository.create({
      userId,
      type,
      title: 'Notification',
      content,
      status: NotificationStatus.SENT,
    });

    return this.notificationRepository.save(notification);
  }

  async getNotifications(userId: string) {
    return this.notificationRepository.find({ where: { userId } });
  }

  async create(dto: CreateNotificationDto) {
    const notification = this.notificationRepository.create({
      userId: dto.userId,
      title: dto.title,
      content: dto.content,
      type: dto.type ?? NotificationType.IN_APP,
      priority: dto.priority,
      metadata: dto.metadata,
      status: NotificationStatus.PENDING,
    });

    return this.notificationRepository.save(notification);
  }

  async send(dto: CreateNotificationDto) {
    const notification = await this.create(dto);

    const prefs = await this.preferencesService.getPreferences(dto.userId);

    if (prefs.globalUnsubscribe) {
      return notification;
    }

    const channels: { enabled: boolean; type: NotificationType }[] = [
      { enabled: prefs.inAppEnabled, type: NotificationType.IN_APP },
      { enabled: prefs.emailEnabled, type: NotificationType.EMAIL },
      { enabled: prefs.pushEnabled, type: NotificationType.PUSH },
      { enabled: prefs.smsEnabled, type: NotificationType.SMS },
    ];

    const dispatches: Promise<Notification>[] = [];

    for (const channel of channels) {
      if (channel.enabled) {
        const channelNotification = this.notificationRepository.create({
          userId: dto.userId,
          title: dto.title,
          content: dto.content,
          type: channel.type,
          priority: dto.priority,
          metadata: dto.metadata,
          status: NotificationStatus.SENT,
        });
        dispatches.push(this.notificationRepository.save(channelNotification));
      }
    }

    await Promise.all(dispatches);

    return notification;
  }

  async sendTemplated(dto: SendTemplatedNotificationDto) {
    const prefs = await this.preferencesService.getPreferences(dto.userId);

    if (prefs.globalUnsubscribe) {
      throw new BadRequestException('User has globally unsubscribed from notifications');
    }

    if (
      prefs.eventFrequency?.[dto.eventType] === 'never'
    ) {
      throw new BadRequestException(
        `User has unsubscribed from event type "${dto.eventType}"`,
      );
    }

    const rendered = await this.templateService.renderByName(
      dto.templateName,
      dto.context,
      dto.templateVersion,
    );

    const channels: { enabled: boolean; type: NotificationType }[] = [
      { enabled: prefs.inAppEnabled, type: NotificationType.IN_APP },
      { enabled: prefs.emailEnabled, type: NotificationType.EMAIL },
      { enabled: prefs.pushEnabled, type: NotificationType.PUSH },
      { enabled: prefs.smsEnabled, type: NotificationType.SMS },
    ];

    const saved: Notification[] = [];

    for (const channel of channels) {
      if (channel.enabled) {
        const notification = this.notificationRepository.create({
          userId: dto.userId,
          title: rendered.subject ?? dto.templateName,
          content: rendered.body,
          type: channel.type,
          status: NotificationStatus.SENT,
          metadata: {
            templateName: dto.templateName,
            templateVersion: rendered.templateVersion,
            eventType: dto.eventType,
          },
        });
        saved.push(await this.notificationRepository.save(notification));
      }
    }

    return saved;
  }

  async findForUser(userId: string, query?: PaginationQueryDto) {
    const limit = query?.limit ?? 20;
    const offset =
      query?.offset ?? (query?.cursor ? undefined : ((query?.page ?? 1) - 1) * limit);

    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId });

    return this.paginationService.paginate(qb, query?.cursor, limit, offset, 'createdAt');
  }

  async markRead(id: string, userId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    if (notification.userId !== userId) {
      throw new BadRequestException('You do not own this notification');
    }

    if (notification.isRead) {
      return notification;
    }

    notification.isRead = true;
    notification.readAt = new Date();

    return this.notificationRepository.save(notification);
  }

  async markManyRead(ids: string[], userId: string) {
    if (!ids.length) {
      return;
    }

    const notifications = await this.notificationRepository.find({
      where: { id: In(ids) },
    });

    if (notifications.length !== ids.length) {
      throw new NotFoundException('One or more notifications not found');
    }

    const owned = notifications.filter((n) => n.userId === userId);
    if (owned.length !== ids.length) {
      throw new BadRequestException('You do not own one or more of these notifications');
    }

    await this.notificationRepository.update(
      { id: In(ids), userId },
      { isRead: true, readAt: new Date() },
    );
  }

  async unsubscribe(userId: string, eventType: string) {
    return this.preferencesService.unsubscribe(userId, eventType);
  }
}
