import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationResponseDto, BulkOperationDto } from './dto/notification.dto';
import { NotificationPreferences } from './entities/notification-preferences.entity';

/**
 * Exposes notifications endpoints.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Returns my Notifications.
   * @param userId The user identifier.
   * @param isRead The is read.
   * @param limit The maximum number of results.
   * @param offset The offset.
   * @returns The operation result.
   */
  @Get()
  @ApiOperation({ summary: 'Get all notifications for current user' })
  @ApiResponse({ status: 200, type: [NotificationResponseDto] })
  async getMyNotifications(
    @CurrentUser('id') userId: string,
    @Query('isRead') isRead?: boolean,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const [data, total] = await this.notificationsService.findAllForUser(userId, {
      isRead,
      limit,
      offset,
    });
    return { data, total };
  }

  /**
   * Marks as Read.
   * @param id The identifier.
   * @param userId The user identifier.
   * @returns The operation result.
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async markAsRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }

  /**
   * Marks all As Read.
   * @param userId The user identifier.
   * @returns The operation result.
   */
  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.notificationsService.markAllAsRead(userId);
  }

  /**
   * Removes notification.
   * @param id The identifier.
   * @param userId The user identifier.
   * @returns The operation result.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async deleteNotification(@Param('id') id: string, @CurrentUser('id') userId: string) {
    await this.notificationsService.remove(id, userId);
  }

  @Patch('bulk-read')
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  async bulkMarkAsRead(@CurrentUser('id') userId: string, @Body() bulkDto: BulkOperationDto) {
    return this.notificationsService.bulkMarkAsRead(bulkDto.ids, userId);
  }

  @Delete('bulk-delete')
  @ApiOperation({ summary: 'Delete multiple notifications' })
  async bulkDelete(@CurrentUser('id') userId: string, @Body() bulkDto: BulkOperationDto) {
    return this.notificationsService.bulkRemove(bulkDto.ids, userId);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get current user notification preferences' })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.notificationsService.getPreferences(userId);
  }

  /**
   * Updates preferences.
   * @param userId The user identifier.
   * @param preferencesDto The request payload.
   * @returns The operation result.
   */
  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() preferencesDto: Partial<NotificationPreferences>,
  ) {
    return this.notificationsService.updatePreferences(userId, preferencesDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get notification delivery statistics (Admin)' })
  async getStats() {
    return this.notificationsService.getDeliveryStats();
  }
}

