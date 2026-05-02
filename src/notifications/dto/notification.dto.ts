import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsBoolean, IsObject, } from 'class-validator';
import { NotificationType, NotificationPriority } from '../entities/notification.entity';

/**
 * Defines the create Notification payload.
 */
export class CreateNotificationDto {
    @ApiProperty({ description: 'The ID of the user the notification is for' })
    @IsUUID()
    @IsNotEmpty()
    userId: string;
    @ApiProperty({ description: 'The title of the notification' })
    @IsString()
    @IsNotEmpty()
    title: string;
    @ApiProperty({ description: 'The content of the notification' })
    @IsString()
    @IsNotEmpty()
    content: string;
    @ApiProperty({ enum: NotificationType, description: 'The type of the notification' })
    @IsEnum(NotificationType)
    @IsOptional()
    type?: NotificationType;
    @ApiProperty({ enum: NotificationPriority, description: 'The priority of the notification' })
    @IsEnum(NotificationPriority)
    @IsOptional()
    priority?: NotificationPriority;
    @ApiPropertyOptional({ description: 'Additional metadata for the notification' })
    @IsObject()
    @IsOptional()
    metadata?: Record<string, unknown>;
}

/**
 * Defines the update Notification payload.
 */
export class UpdateNotificationDto {
    @ApiPropertyOptional({ description: 'Mark as read or unread' })
    @IsBoolean()
    @IsOptional()
    isRead?: boolean;
}

/**
 * Defines the notification Response payload.
 */
export class NotificationResponseDto {
    @ApiProperty()
    id: string;
    @ApiProperty()
    userId: string;
    @ApiProperty()
    title: string;
    @ApiProperty()
    content: string;
    @ApiProperty({ enum: NotificationType })
    type: NotificationType;
    @ApiProperty({ enum: NotificationPriority })
    priority: NotificationPriority;
    @ApiProperty()
    isRead: boolean;
    @ApiPropertyOptional()
    readAt?: Date;
    @ApiProperty()
    createdAt: Date;
}

export class BulkOperationDto {
  @ApiProperty({ type: [String], description: 'List of notification IDs' })
  @IsUUID('all', { each: true })
  @IsNotEmpty({ each: true })
  ids: string[];
}
