import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { CreateNotificationDto, UpdateNotificationDto, NotificationResponseDto } from './dto/notification.dto';
import { PreferencesService } from './preferences/preferences.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    private preferencesService: PreferencesService,
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationsRepository.create(createNotificationDto);
    return await this.notificationsRepository.save(notification);
  }

  async findAll(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      type?: NotificationType;
      isRead?: boolean;
    } = {}
  ): Promise<{ notifications: NotificationResponseDto[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, type, isRead } = options;
    
    const queryOptions: FindManyOptions<Notification> = {
      where: {
        userId,
        isActive: true,
        ...(type && { type }),
        ...(isRead !== undefined && { isRead })
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit
    };

    const [notifications, total] = await this.notificationsRepository.findAndCount(queryOptions);
    
    return {
      notifications: notifications.map(this.toResponseDto),
      total,
      page,
      limit
    };
  }

  async findOne(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id, userId, isActive: true }
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.findOne(id, userId);
    
    notification.isRead = true;
    notification.readAt = new Date();
    
    return await this.notificationsRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationsRepository.update(
      { userId, isRead: false, isActive: true },
      { isRead: true, readAt: new Date() }
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationsRepository.count({
      where: { userId, isRead: false, isActive: true }
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const notification = await this.findOne(id, userId);
    notification.isActive = false;
    await this.notificationsRepository.save(notification);
  }

  async createBulkNotifications(
    userIds: string[],
    notificationData: Omit<CreateNotificationDto, 'userId'>
  ): Promise<Notification[]> {
    const notifications = userIds.map(userId => 
      this.notificationsRepository.create({ ...notificationData, userId })
    );
    
    return await this.notificationsRepository.save(notifications);
  }

  async canUserReceiveNotification(userId: string, type: NotificationType): Promise<boolean> {
    return await this.preferencesService.canSendNotification(userId, type, 'inApp');
  }

  private toResponseDto(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      isRead: notification.isRead,
      metadata: notification.metadata,
      actionUrl: notification.actionUrl,
      createdAt: notification.createdAt,
      readAt: notification.readAt
    };
  }
}
