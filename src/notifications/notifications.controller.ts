import { Controller, Get, Param, Body, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService, NotificationPreferences } from './preferences/preferences.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly preferencesService: NotificationPreferencesService,
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
} 