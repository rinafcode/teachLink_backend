import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Notification, NotificationType, NotificationPriority } from './entities/notification.entity';
import { NotificationPreferences } from './entities/notification-preferences.entity';
import { CreateNotificationDto, UpdateNotificationDto } from './dto/notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationTemplatesService } from './notification-templates.service';
import { PreferencesService } from './preferences/preferences.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly gateway: NotificationsGateway,
    private readonly templatesService: NotificationTemplatesService,
    private readonly preferencesService: PreferencesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create and send a notification
   */
  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const { userId, title, content, type, priority, metadata } = createNotificationDto;

    // Check user preferences
    const preferences = await this.preferencesService.getPreferences(userId);
    const shouldSend = this.shouldSendNotification(type || NotificationType.IN_APP, preferences);

    if (!shouldSend) {
      this.logger.debug(`Notification skipped for user ${userId} based on preferences`);
    }

    // Save to database
    const notification = this.notificationRepository.create({
      userId,
      title,
      content,
      type: type || NotificationType.IN_APP,
      priority: priority || NotificationPriority.MEDIUM,
      metadata,
    });

    const savedNotification = await this.notificationRepository.save(notification);

    // Send via appropriate channel if enabled
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
      // 1. Always try internal push via WebSocket if it's IN_APP or PUSH
      if (
        notification.type === NotificationType.IN_APP ||
        notification.type === NotificationType.PUSH
      ) {
        await this.gateway.sendToUser(notification.userId, notification);
      }

      // 2. Handle EMAIL type
      if (notification.type === NotificationType.EMAIL) {
        await this.sendEmailNotification(notification);
      }

      // 3. Handle PUSH type (external push e.g. FCM/WebPush - placeholder)
      if (notification.type === NotificationType.PUSH) {
        await this.sendExternalPushNotification(notification);
      }
    } catch (error) {
      this.logger.error(`Failed to send notification ${notification.id}:`, error);
    }
  }

  private async sendEmailNotification(notification: Notification): Promise<void> {
    this.logger.log(`Sending email notification to user ${notification.userId}: ${notification.title}`);
    // Here you would integrate with a MailerService
    // Example: await this.mailerService.sendMail({ ... });
  }

  private async sendExternalPushNotification(notification: Notification): Promise<void> {
    this.logger.log(`Sending external push notification to user ${notification.userId}: ${notification.title}`);
    // Here you would integrate with FCM, OneSignal, etc.
  }

  /**
   * Get all notifications for a user
   */
  async findAllForUser(userId: string, options: { isRead?: boolean; limit?: number; offset?: number } = {}): Promise<[Notification[], number]> {
    const query = this.notificationRepository.createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId });

    if (options.isRead !== undefined) {
      query.andWhere('notification.isRead = :isRead', { isRead: options.isRead });
    }

    query.orderBy('notification.createdAt', 'DESC')
      .take(options.limit || 20)
      .skip(options.offset || 0);

    return query.getManyAndCount();
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({ where: { id, userId } });
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
      { isRead: true, readAt: new Date() }
    );
  }

  /**
   * Delete a notification
   */
  async remove(id: string, userId: string): Promise<void> {
    const result = await this.notificationRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(userId: string, updateDto: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    return this.preferencesService.updatePreferences(userId, updateDto);
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return this.preferencesService.getPreferences(userId);
  }

  private shouldSendNotification(type: NotificationType, preferences: NotificationPreferences): boolean {
    switch (type) {
      case NotificationType.EMAIL: return preferences.emailEnabled;
      case NotificationType.PUSH: return preferences.pushEnabled;
      case NotificationType.IN_APP: return preferences.inAppEnabled;
      case NotificationType.SMS: return preferences.smsEnabled;
      default: return true;
    }
  }

  /**
   * Event listener for system-wide notifications
   */
  @OnEvent('notification.send')
  async handleSendNotification(payload: CreateNotificationDto) {
    await this.create(payload);
  }

  /**
   * Event listener for specific templates
   */
  @OnEvent('notification.template.send')
  async handleSendTemplateNotification(payload: { userId: string; templateType: string; data: any; type?: NotificationType }) {
    const template = this.templatesService.renderTemplate(payload.templateType, payload.data);
    
    await this.create({
      userId: payload.userId,
      title: template.title,
      content: template.content,
      type: payload.type || NotificationType.IN_APP,
      priority: NotificationPriority.MEDIUM,
    });
  }
}
