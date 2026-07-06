import { Body, Controller, Get, Param, Patch, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PreferencesService } from './preferences/preferences.service';
import { NotificationTemplateService } from './templates/notification-template.service';
import { CreateNotificationDto, BulkOperationDto } from './dto/notification.dto';
import {
  UpdateNotificationPreferencesDto,
  UnsubscribeDto,
  SendTemplatedNotificationDto,
} from './dto/preferences.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { Notification } from './entities/notification.entity';
import { PaginatedSwaggerDto } from '../common/dto/paginated-response.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly preferencesService: PreferencesService,
    private readonly templateService: NotificationTemplateService,
  ) {}

  @Get('preferences/:userId')
  @ApiOperation({ summary: 'Get notification preferences (for preferences UI)' })
  getPreferences(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.preferencesService.getPreferences(userId);
  }

  @Patch('preferences/:userId')
  @ApiOperation({ summary: 'Update notification preferences' })
  updatePreferences(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.preferencesService.updatePreferences(userId, dto);
  }

  @Post('preferences/:userId/toggle/:channel')
  @ApiOperation({ summary: 'Toggle email, push, in-app, or SMS channel' })
  async toggleChannel(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('channel') channel: 'email' | 'push' | 'in-app' | 'sms',
  ) {
    const map = {
      email: 'emailEnabled',
      push: 'pushEnabled',
      'in-app': 'inAppEnabled',
      sms: 'smsEnabled',
    } as const;
    await this.preferencesService.toggleChannel(userId, map[channel]);
    return this.preferencesService.getPreferences(userId);
  }

  @Post('unsubscribe/:userId')
  @ApiOperation({ summary: 'Unsubscribe from event type or all notifications' })
  unsubscribe(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: UnsubscribeDto) {
    return this.notificationsService.unsubscribe(userId, dto.eventType);
  }

  @Get()
  @ApiOperation({ summary: 'List in-app notifications for user with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of notifications',
    type: PaginatedSwaggerDto(Notification),
  })
  list(@Query('userId', ParseUUIDPipe) userId: string, @Query() query?: PaginationQueryDto) {
    return this.notificationsService.findForUser(userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create and dispatch notification' })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Post('templated')
  @ApiOperation({ summary: 'Send versioned templated notification across enabled channels' })
  sendTemplated(@Body() dto: SendTemplatedNotificationDto) {
    return this.notificationsService.sendTemplated(dto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@Param('id', ParseUUIDPipe) id: string, @Query('userId', ParseUUIDPipe) userId: string) {
    return this.notificationsService.markRead(id, userId);
  }

  @Post('bulk/read')
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  bulkRead(@Query('userId', ParseUUIDPipe) userId: string, @Body() dto: BulkOperationDto) {
    return this.notificationsService.markManyRead(dto.ids, userId);
  }
}
