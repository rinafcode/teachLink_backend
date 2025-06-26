import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { NotificationDto } from './dto/notification.dto';
import { NotificationPreferencesService } from './preferences/preferences.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  async createNotification(userId: string, type: NotificationType, content: string): Promise<NotificationDto | null> {
    if (!this.preferencesService.isEnabled(userId, type)) {
      return null;
    }
    const notification = this.notificationRepo.create({ userId, type, content });
    const saved = await this.notificationRepo.save(notification);
    return saved;
  }

  async getUserNotifications(userId: string): Promise<NotificationDto[]> {
    return this.notificationRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.notificationRepo.update(notificationId, { isRead: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.update({ userId, isRead: false }, { isRead: true });
  }
}