import { Controller, Get, Param, Body, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService, NotificationPreferences } from './preferences/preferences.service';
import { NotificationDelivery, DeliveryStatus } from './entities/notification-delivery.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly preferencesService: NotificationPreferencesService,
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,
  ) {}

  @Get(':userId')
  async getUserNotifications(@Param('userId') userId: string) {
    return this.notificationsService.getUserNotifications(userId);
  }

  @Post('preferences/:userId')
  setPreferences(@Param('userId') userId: string, @Body() prefs: NotificationPreferences) {
    this.preferencesService.setPreferences(userId, prefs);
    return { success: true };
  }

  // Admin: Get all delivery logs
  @Get('admin/deliveries')
  async getAllDeliveries() {
    return this.deliveryRepo.find({ order: { createdAt: 'DESC' } });
  }

  // Admin: Get notification analytics (counts by type and status)
  @Get('admin/analytics')
  async getAnalytics() {
    const deliveries = await this.deliveryRepo.find();
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    deliveries.forEach(d => {
      byType[d.channel] = (byType[d.channel] || 0) + 1;
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    });
    return { byType, byStatus };
  }

  // Admin: Get user engagement (number of opened notifications per user)
  @Get('admin/engagement')
  async getEngagement() {
    const deliveries = await this.deliveryRepo.find({ where: { status: DeliveryStatus.OPENED } });
    const engagement: Record<string, number> = {};
    deliveries.forEach(d => {
      engagement[d.userId] = (engagement[d.userId] || 0) + 1;
    });
    return engagement;
  }
} 