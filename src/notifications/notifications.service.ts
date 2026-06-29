import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Notification, NotificationType, NotificationStatus } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
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
      return duplicate; // deduplicated
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
}
