import { IsString, IsEnum, IsOptional, IsBoolean, IsObject, IsUUID } from 'class-validator';
import { NotificationType, NotificationPriority } from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  actionUrl?: string;
}

export class UpdateNotificationDto {
  @IsBoolean()
  @IsOptional()
  isRead?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class NotificationResponseDto {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  metadata?: Record<string, any>;
  actionUrl?: string;
  createdAt: Date;
  readAt?: Date;
}

export class CreatePreferenceDto {
  @IsUUID()
  userId: string;

  @IsEnum(NotificationType)
  notificationType: NotificationType;

  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  inAppEnabled?: boolean;

  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}

export class UpdatePreferenceDto {
  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  inAppEnabled?: boolean;

  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}