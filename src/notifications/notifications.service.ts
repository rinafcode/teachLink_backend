import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { APP_EVENTS } from '../common/constants/event.constants';
import {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
} from './entities/notification.entity';
import { NotificationsQueueService } from './notifications.queue';
import { NotificationPreferences } from './entities/notification-preferences.entity';
import { CreateNotificationDto } from './dto/notification.dto';
import { NotificationsGateway } from '../gateways/notifications/notifications.gateway';
import { NotificationTemplatesService } from './notification-templates.service';
import { PreferencesService } from './preferences/preferences.service';
import { EmailService } from './email/email.service';
import { sanitizeEmail } from '../common/utils/pii-sanitizer.utils';

/**
 * Provides notification operations.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly gateway: NotificationsGateway,
    private readonly templatesService: NotificationTemplatesService,
    private readonly preferencesService: PreferencesService,
    private readonly emailService: EmailService,
    private readonly queueService: NotificationsQueueService,
  ) {}

  /**
   * Sends verification Email.
   * @param email The email address.
   * @param token The token value.
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    try {
      await this.emailService.sendVerificationEmail(email, token);
      this.logger.log(`Verification email sent to ${sanitizeEmail(email)}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${sanitizeEmail(email)}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Sends password Reset Email.
   * @param email The email address.
   * @param token The token value.
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    try {
      await this.emailService.sendPasswordResetEmail(email, token);
      this.logger.log(`Password reset email sent to ${sanitizeEmail(email)}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${sanitizeEmail(email)}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Create and send a notification
   */
  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const { userId, title, content, type, priority, metadata } = createNotificationDto;

    const preferences = await this.preferencesService.getPreferences(userId);
    const shouldSend = this.shouldSendNotification(type || NotificationType.IN_APP, preferences);

    if (!shouldSend) {
      this.logger.debug(`Notification skipped for user ${userId} based on preferences`);
    }

    const notification = this.notificationRepository.create({
      userId,
      title,
      content,
      type: type || NotificationType.IN_APP,
      priority: priority || NotificationPriority.MEDIUM,
      status: NotificationStatus.PENDING,
      metadata,
    });

    const savedNotification = await this.notificationRepository.save(notification);

    if (shouldSend) {
      await this.sendNotification(savedNotification);
    }

    return savedNotification;
  }

  /**
   * Send notification via the specified channel
   */
  private async sendNotification(notification: Notification): Promise<void> {
    try {
      // In-app notifications are delivered via WebSocket
      if (
        notification.type === NotificationType.IN_APP ||
        notification.type === NotificationType.PUSH
      ) {
        await this.gateway.sendToUser(notification.userId, notification);
        
        if (notification.type === NotificationType.IN_APP) {
          await this.notificationRepository.update(notification.id, {
            status: NotificationStatus.DELIVERED,
          });
        }
      }

      // External notifications are delivered via SNS/SQS queue
      if (
        notification.type === NotificationType.EMAIL ||
        notification.type === NotificationType.PUSH ||
        notification.type === NotificationType.SMS
      ) {
        await this.queueService.publishToTopic(notification);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send notification ${notification.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      
      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.FAILED,
        failureReason: error.message,
      });
    }
  }


  private async sendEmailNotification(notification: Notification): Promise<void> {
    this.logger.log(
      `Sending email notification to user ${notification.userId}: ${notification.title}`,
    );
    // Integrate with EmailService or MailerService here if notification email delivery is required
  }

  private async sendExternalPushNotification(notification: Notification): Promise<void> {
    this.logger.log(
      `Sending external push notification to user ${notification.userId}: ${notification.title}`,
    );
    // Integrate with FCM, OneSignal, etc.
  }

  /**
   * Get all notifications for a user
   */
  async findAllForUser(
    userId: string,
    options: { isRead?: boolean; limit?: number; offset?: number } = {},
  ): Promise<[Notification[], number]> {
    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId });

    if (options.isRead !== undefined) {
      query.andWhere('notification.isRead = :isRead', {
        isRead: options.isRead,
      });
    }

    query
      .orderBy('notification.createdAt', 'DESC')
      .take(options.limit || 20)
      .skip(options.offset || 0);

    return query.getManyAndCount();
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    notification.isRead = true;
    notification.readAt = new Date();
    return this.notificationRepository.save(notification);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }

  /**
   * Mark multiple notifications as read
   */
  async bulkMarkAsRead(
    ids: string[],
    userId: string,
  ): Promise<{ success: string[]; failed: string[] }> {
    const results = { success: [], failed: [] };

    for (const id of ids) {
      try {
        await this.markAsRead(id, userId);
        results.success.push(id);
      } catch (error) {
        this.logger.error(`Failed to mark notification ${id} as read in bulk`, error);
        results.failed.push(id);
      }
    }

    return results;
  }

  /**
   * Delete multiple notifications
   */
  async bulkRemove(
    ids: string[],
    userId: string,
  ): Promise<{ success: string[]; failed: string[] }> {
    const results = { success: [], failed: [] };

    for (const id of ids) {
      try {
        await this.remove(id, userId);
        results.success.push(id);
      } catch (error) {
        this.logger.error(`Failed to delete notification ${id} in bulk`, error);
        results.failed.push(id);
      }
    }

    return results;
  }

  /**
   * Delete a notification
   */
  async remove(id: string, userId: string): Promise<void> {
    const result = await this.notificationRepository.softDelete({ id, userId });

    if (result.affected === 0) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userId: string,
    updateDto: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    return this.preferencesService.updatePreferences(userId, updateDto);
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return this.preferencesService.getPreferences(userId);
  }

  private shouldSendNotification(
    type: NotificationType,
    preferences: NotificationPreferences,
  ): boolean {
    switch (type) {
      case NotificationType.EMAIL:
        return preferences.emailEnabled;
      case NotificationType.PUSH:
        return preferences.pushEnabled;
      case NotificationType.IN_APP:
        return preferences.inAppEnabled;
      case NotificationType.SMS:
        return preferences.smsEnabled;
      default:
        return true;
    }
  }

  /**
   * Event listener for system-wide notifications
   */
  @OnEvent(APP_EVENTS.NOTIFICATION_SEND)
  async handleSendNotification(payload: CreateNotificationDto): Promise<void> {
    await this.create(payload);
  }

  /**
   * Event listener for specific templates
   */
  @OnEvent(APP_EVENTS.NOTIFICATION_TEMPLATE_SEND)
  async handleSendTemplateNotification(payload: {
    userId: string;
    templateType: string;
    data: any;
    type?: NotificationType;
  }): Promise<void> {
    const template = this.templatesService.renderTemplate(payload.templateType, payload.data);

    await this.create({
      userId: payload.userId,
      title: template.title,
      content: template.content,
      type: payload.type || NotificationType.IN_APP,
      priority: NotificationPriority.MEDIUM,
    });
  }

  /**
   * Get delivery statistics for the dashboard
   */
  async getDeliveryStats(): Promise<any> {
    const total = await this.notificationRepository.count();
    const delivered = await this.notificationRepository.count({
      where: { status: NotificationStatus.DELIVERED },
    });
    const sent = await this.notificationRepository.count({
      where: { status: NotificationStatus.SENT },
    });
    const failed = await this.notificationRepository.count({
      where: { status: NotificationStatus.FAILED },
    });
    const retrying = await this.notificationRepository.count({
      where: { status: NotificationStatus.RETRYING },
    });

    const failureRate = total > 0 ? (failed / total) * 100 : 0;

    if (failureRate > 10) {
      this.logger.warn(`HIGH FAILURE RATE DETECTED: ${failureRate.toFixed(2)}%`);
      // In a real system, you would trigger an alert here (PagerDuty, Slack, etc.)
    }

    return {
      total,
      delivered,
      sent,
      failed,
      retrying,
      failureRate: `${failureRate.toFixed(2)}%`,
      timestamp: new Date(),
    };
  }
}

