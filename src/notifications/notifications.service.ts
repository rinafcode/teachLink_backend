import { Injectable, Optional, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, MoreThan, In } from 'typeorm';
import * as crypto from 'crypto';
import { Notification, NotificationType, NotificationStatus } from './entities/notification.entity';
import { PaginationService } from '../common/services/pagination.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreateNotificationDto } from './dto/notification.dto';
import { SendTemplatedNotificationDto } from './dto/preferences.dto';
import { PreferencesService } from './preferences/preferences.service';
import { NotificationTemplateService } from './templates/notification-template.service';
import { clampLimit } from '../common/utils/pagination.utils';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private readonly preferencesService: PreferencesService,
    private readonly templateService: NotificationTemplateService,
    private readonly dataSource: DataSource,
    @Optional()
    private paginationService: PaginationService = new PaginationService(),
  ) {}

  /**
   * Generates a deterministic SHA-256 hash for raw content.
   */
  private hashContent(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content || '')
      .digest('hex');
  }

  async findDuplicate(userId: string, type: NotificationType, content: string) {
    const contentHash = this.hashContent(content);

    return this.notificationRepository.findOne({
      where: {
        userId,
        type,
        contentHash,
        createdAt: MoreThan(new Date(Date.now() - 5 * 60 * 1000)),
      },
    });
  }

  async sendNotification(userId: string, type: NotificationType, content: string) {
    const duplicate = await this.findDuplicate(userId, type, content);
    if (duplicate) {
      return duplicate;
    }

    const contentHash = this.hashContent(content);

    const notification = this.notificationRepository.create({
      userId,
      type,
      title: 'Notification',
      content,
      contentHash,
      status: NotificationStatus.SENT,
    });

    return this.notificationRepository.save(notification);
  }

  async getNotifications(
    userId: string,
    query?: PaginationQueryDto & { status?: NotificationStatus; isRead?: boolean | string },
  ) {
    const limit = clampLimit(query?.limit);
    const offset =
      query?.offset ?? (query?.cursor ? undefined : ((query?.page ?? 1) - 1) * limit);
    const rawOrder = query?.order ? String(query.order).toUpperCase() : 'DESC';
    const order = (rawOrder === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC';

    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId });

    if (query?.isRead !== undefined) {
      let isReadVal: boolean | undefined;
      if (typeof query.isRead === 'string') {
        if (query.isRead === 'true' || query.isRead === '1') isReadVal = true;
        else if (query.isRead === 'false' || query.isRead === '0') isReadVal = false;
        else isReadVal = undefined;
      } else {
        isReadVal = query.isRead;
      }
      if (isReadVal !== undefined) {
        qb.andWhere('notification.isRead = :isRead', { isRead: isReadVal });
      }
    }

    if (query?.status !== undefined) {
      qb.andWhere('notification.status = :status', { status: query.status });
    }

    // Ensure deterministic ordering newest-first when no explicit order,
    // using the composite index on (userId, createdAt DESC) and
    // (userId, isRead, createdAt) / (userId, status, createdAt) for filtered queries.
    return this.paginationService.paginate(qb, query?.cursor, limit, offset, 'createdAt', order);
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
    // The base notification plus every channel dispatch is one logical
    // operation: if any channel write fails, none of them persist (issue
    // #1344).
    return this.dataSource.transaction(async (manager) => {
      const notificationRepository = manager.getRepository(Notification);

      const notification = await notificationRepository.save(
        notificationRepository.create({
          userId: dto.userId,
          title: dto.title,
          content: dto.content,
          contentHash: this.hashContent(dto.content),
          type: dto.type ?? NotificationType.IN_APP,
          priority: dto.priority,
          metadata: dto.metadata,
          status: NotificationStatus.PENDING,
        }),
      );

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
          const channelNotification = notificationRepository.create({
            userId: dto.userId,
            title: dto.title,
            content: dto.content,
            contentHash: this.hashContent(dto.content),
            type: channel.type,
            priority: dto.priority,
            metadata: dto.metadata,
            status: NotificationStatus.SENT,
          });
          dispatches.push(notificationRepository.save(channelNotification));
        }
      }

      await Promise.all(dispatches);

      return notification;
    });
  }

  async sendTemplated(dto: SendTemplatedNotificationDto) {
    const prefs = await this.preferencesService.getPreferences(dto.userId);

    if (prefs.globalUnsubscribe) {
      throw new BadRequestException('User has globally unsubscribed from notifications');
    }

    if (prefs.eventFrequency?.[dto.eventType] === 'never') {
      throw new BadRequestException(`User has unsubscribed from event type "${dto.eventType}"`);
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

    // All channel dispatches are one logical operation (issue #1344).
    return this.dataSource.transaction(async (manager) => {
      const notificationRepository = manager.getRepository(Notification);
      const saved: Notification[] = [];

      for (const channel of channels) {
        if (channel.enabled) {
          const notification = notificationRepository.create({
            userId: dto.userId,
            title: rendered.subject ?? dto.templateName,
            content: rendered.body,
            contentHash: this.hashContent(rendered.body),
            type: channel.type,
            status: NotificationStatus.SENT,
            metadata: {
              templateName: dto.templateName,
              templateVersion: rendered.templateVersion,
              eventType: dto.eventType,
            },
          });
          saved.push(await notificationRepository.save(notification));
        }
      }

      return saved;
    });
  }

  async findForUser(
    userId: string,
    query?: PaginationQueryDto & { status?: NotificationStatus; isRead?: boolean | string },
  ) {
    // Delegate to getNotifications to ensure single source of truth for
    // pagination, ordering (DESC newest-first), and indexed filtering.
    return this.getNotifications(userId, query);
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
