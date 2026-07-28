import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, FindOptionsWhere } from 'typeorm';
import * as crypto from 'crypto';
import { Notification, NotificationType, NotificationStatus } from './entities/notification.entity';
import { PaginationQueryDto, SortOrder } from '../common/dto/pagination.dto';
import { clampLimit, buildOffsetResponse } from '../common/utils/pagination.utils';
import { OffsetPaginatedResponse } from '../common/interfaces/pagination.interface';

export type GetNotificationsQuery = PaginationQueryDto & {
  status?: NotificationStatus;
  unread?: boolean;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
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

  /**
   * Returns a paginated page of notifications for the user, newest first.
   * Rows older than `retention.notificationRetentionDays` are removed by the data-retention job.
   */
  async getNotifications(
    userId: string,
    query?: GetNotificationsQuery,
  ): Promise<OffsetPaginatedResponse<Notification>> {
    const limit = clampLimit(query?.limit);
    const page = query?.page ?? 1;
    const skip = query?.offset ?? (page - 1) * limit;
    const resolvedPage = query?.offset !== undefined ? Math.floor(skip / limit) + 1 : page;

    const where: FindOptionsWhere<Notification> = { userId };
    if (query?.status !== undefined) {
      where.status = query.status;
    }
    if (query?.unread === true) {
      where.isRead = false;
    } else if (query?.unread === false) {
      where.isRead = true;
    }

    const order = query?.order ?? SortOrder.DESC;

    const [data, total] = await this.notificationRepository.findAndCount({
      where,
      order: { createdAt: order },
      skip,
      take: limit,
    });

    return buildOffsetResponse(data, total, resolvedPage, limit);
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
  async findForUser(userId: string, query?: GetNotificationsQuery) {
    return this.getNotifications(userId, query);
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
