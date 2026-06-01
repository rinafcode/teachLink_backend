import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In, Repository } from 'typeorm';
import {
  Notification,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from './entities/notification.entity';
import { NotificationsQueueService } from './notifications.queue';

interface QueueNotificationPayload {
  userId: string;
  title: string;
  content: string;
  type: NotificationType;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
}

const DEFAULT_BATCH_WINDOW_MS = 5 * 60 * 1000;

const BATCH_CONFIG: Record<NotificationType, { intervalMs: number; batchLabel: string }> = {
  [NotificationType.EMAIL]: { intervalMs: DEFAULT_BATCH_WINDOW_MS, batchLabel: 'Email Digest' },
  [NotificationType.PUSH]: { intervalMs: 2 * 60 * 1000, batchLabel: 'Push Summary' },
  [NotificationType.IN_APP]: { intervalMs: DEFAULT_BATCH_WINDOW_MS, batchLabel: 'In-App Summary' },
  [NotificationType.SMS]: { intervalMs: DEFAULT_BATCH_WINDOW_MS, batchLabel: 'SMS Digest' },
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly batchWindowMs: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly notificationsQueue: NotificationsQueueService,
  ) {
    const batchWindowSetting = this.configService.get<string | number>('NOTIFICATION_BATCH_WINDOW_MS', `${DEFAULT_BATCH_WINDOW_MS}`);
    this.batchWindowMs = Number(batchWindowSetting) || DEFAULT_BATCH_WINDOW_MS;
  }

  async send(notification: QueueNotificationPayload): Promise<Notification> {
    const priority = notification.priority ?? NotificationPriority.MEDIUM;
    const isUrgent = priority === NotificationPriority.URGENT;

    const duplicate = await this.findDuplicate(notification);
    if (duplicate) {
      this.logger.log(`Deduplicated notification for user ${notification.userId}`);
      return duplicate;
    }

    const record = this.notificationRepository.create({
      ...notification,
      priority,
      status: isUrgent ? NotificationStatus.SENT : NotificationStatus.PENDING,
      deliveryAttempts: 0,
    });

    const saved = await this.notificationRepository.save(record);

    if (isUrgent) {
      await this.publish(saved, true);
    }

    return saved;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async flushBatches(): Promise<void> {
    const pendingNotifications = await this.notificationRepository.find({
      where: { status: NotificationStatus.PENDING },
      order: { createdAt: 'ASC' },
    });

    if (pendingNotifications.length === 0) {
      return;
    }

    const now = Date.now();
    const groups = new Map<string, Notification[]>();

    pendingNotifications.forEach((notification) => {
      const key = `${notification.userId}:${notification.type}`;
      const group = groups.get(key) ?? [];
      group.push(notification);
      groups.set(key, group);
    });

    for (const [key, notifications] of groups) {
      const type = notifications[0].type;
      const { intervalMs } = BATCH_CONFIG[type];
      const oldest = notifications[0];

      if (now - oldest.createdAt.getTime() < intervalMs) {
        continue;
      }

      await this.publishBatch(notifications);
    }
  }

  private async publishBatch(notifications: Notification[]): Promise<void> {
    const first = notifications[0];
    const batchTitle = `${BATCH_CONFIG[first.type].batchLabel}`;
    const body = notifications
      .map((notification, index) => `${index + 1}. ${notification.title}: ${notification.content}`)
      .join('\n');

    const batchNotification = this.notificationRepository.create({
      userId: first.userId,
      title: batchTitle,
      content: body,
      type: first.type,
      priority: NotificationPriority.MEDIUM,
      status: NotificationStatus.SENT,
      metadata: { batched: true, count: notifications.length },
      deliveryAttempts: 0,
    });

    await this.notificationsQueue.publishToTopic(batchNotification);
    const ids = notifications.map((notification) => notification.id);
    await this.notificationRepository.update({ id: In(ids) }, { status: NotificationStatus.SENT, lastAttemptAt: new Date() });
    await this.notificationRepository.save(batchNotification);

    this.logger.log(`Flushed ${notifications.length} notifications into a batch for user ${first.userId}`);
  }

  private async publish(notification: Notification, bypassBatch = false): Promise<void> {
    await this.notificationsQueue.publishToTopic(notification, { bypassBatch });
    await this.notificationRepository.update(notification.id, {
      status: NotificationStatus.SENT,
      lastAttemptAt: new Date(),
      deliveryAttempts: notification.deliveryAttempts + 1,
    });
  }

  private async findDuplicate(payload: QueueNotificationPayload): Promise<Notification | null> {
    const existing = await this.notificationRepository.findOne({
      where: {
        userId: payload.userId,
        title: payload.title,
        content: payload.content,
        type: payload.type,
        status: NotificationStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });

    if (!existing) {
      return null;
    }

    const age = Date.now() - existing.createdAt.getTime();
    return age <= this.batchWindowMs ? existing : null;
  }
}
