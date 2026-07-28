import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as crypto from 'crypto';
import {
  Notification,
  NotificationType,
  NotificationStatus,
} from './entities/notification.entity';
import { PaginationService } from '../common/services/pagination.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @Optional()
    private paginationService: PaginationService = new PaginationService(),
  ) {}

  /**
   * Generates a deterministic SHA-256 hash for raw content.
   */
  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content || '').digest('hex');
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

  async getNotifications(userId: string) {
    return this.notificationRepository.find({ where: { userId } });
  }

  // Stubs for other methods (to satisfy typecheck)
  async send(_dto: any) {
    return null;
  }
  async sendTemplated(_dto: any) {
    return [];
  }
  async unsubscribe(_userId: string, _eventType: string) {
    return;
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
  async create(_dto: any) {
    return null;
  }
  async markRead(_id: string, _userId: string) {
    return null;
  }
  async markManyRead(_ids: string[], _userId: string) {
    return;
  }
}