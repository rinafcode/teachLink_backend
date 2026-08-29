import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
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
import { Notification, NotificationStatus } from './entities/notification.entity';
import { PaginatedSwaggerDto } from '../common/dto/paginated-response.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export class NotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by read status', type: Boolean })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean({ message: 'isRead must be a boolean' })
  isRead?: boolean;

  @ApiPropertyOptional({ description: 'Filter by notification status', enum: NotificationStatus })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly preferencesService: PreferencesService,
    private readonly templateService: NotificationTemplateService,
  ) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences (for authenticated user)' })
  getPreferences(@Req() req: any) {
    return this.preferencesService.getPreferences(req.user.id);
  }

  @Get('preferences/:userId')
  @Roles('admin')
  @ApiOperation({ summary: 'Get notification preferences for specific user (Admin only)' })
  getPreferencesAdmin(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.preferencesService.getPreferences(userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  updatePreferences(@Req() req: any, @Body() dto: UpdateNotificationPreferencesDto) {
    return this.preferencesService.updatePreferences(req.user.id, dto);
  }

  @Post('preferences/toggle/:channel')
  @ApiOperation({ summary: 'Toggle email, push, in-app, or SMS channel' })
  async toggleChannel(
    @Req() req: any,
    @Param('channel') channel: 'email' | 'push' | 'in-app' | 'sms',
  ) {
    const map = {
      email: 'emailEnabled',
      push: 'pushEnabled',
      'in-app': 'inAppEnabled',
      sms: 'smsEnabled',
    } as const;
    await this.preferencesService.toggleChannel(req.user.id, map[channel]);
    return this.preferencesService.getPreferences(req.user.id);
  }

  @Post('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from event type or all notifications' })
  unsubscribe(@Req() req: any, @Body() dto: UnsubscribeDto) {
    return this.notificationsService.unsubscribe(req.user.id, dto.eventType);
  }

  @Get()
  @ApiOperation({ summary: 'List in-app notifications for authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of notifications',
    type: PaginatedSwaggerDto(Notification),
  })
  list(@Req() req: any, @Query() query?: NotificationsQueryDto) {
    return this.notificationsService.findForUser(req.user.id, query);
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
  markRead(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markRead(id, req.user.id);
  }

  @Post('bulk/read')
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  bulkRead(@Req() req: any, @Body() dto: BulkOperationDto) {
    return this.notificationsService.markManyRead(dto.ids, req.user.id);
  }
}
