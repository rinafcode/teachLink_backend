import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PreferencesService } from './preferences/preferences.service';
import { NotificationsGateway } from './notifications.gateway';
import {
  CreateNotificationDto,
  UpdateNotificationDto,
  CreatePreferenceDto,
  UpdatePreferenceDto,
} from './dto/notification.dto';
import { NotificationType } from './entities/notification.entity';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly preferencesService: PreferencesService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Post()
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    const notification = await this.notificationsService.create(createNotificationDto);
    
    // Send real-time notification
    await this.notificationsGateway.sendNotificationToUser(notification.userId, {
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
    });

    return notification;
  }

  @Get()
  async findAll(
    @Query('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: NotificationType,
    @Query('isRead') isRead?: boolean,
  ) {
    return this.notificationsService.findAll(userId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      type,
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
    });
  }

  @Get('unread-count/:userId')
  async getUnreadCount(@Param('userId') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Put(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Put('mark-all-read')
  async markAllAsRead(@Query('userId') userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    await this.notificationsService.delete(id, userId);
    return { success: true };
  }

  // Preferences endpoints
  @Post('preferences')
  async createPreference(@Body() createPreferenceDto: CreatePreferenceDto) {
    return this.preferencesService.createPreference(createPreferenceDto);
  }

  @Get('preferences/:userId')
  async getUserPreferences(@Param('userId') userId: string) {
    return this.preferencesService.getUserPreferences(userId);
  }

  @Put('preferences/:userId/:type')
  async updatePreference(
    @Param('userId') userId: string,
    @Param('type') type: NotificationType,
    @Body() updatePreferenceDto: UpdatePreferenceDto,
  ) {
    return this.preferencesService.updatePreference(userId, type, updatePreferenceDto);
  }

  @Post('preferences/initialize/:userId')
  async initializePreferences(@Param('userId') userId: string) {
    return this.preferencesService.initializeDefaultPreferences(userId);
  }

  // Broadcast notification to multiple users
  @Post('broadcast')
  async broadcastNotification(
    @Body() data: { userIds: string[]; notification: Omit<CreateNotificationDto, 'userId'> }
  ) {
    await this.notificationsGateway.broadcastNotification(data.userIds, data.notification);
    return { success: true };
  }
}