import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Topic/event subscriptions' })
  @IsOptional()
  @IsObject()
  topicSubscriptions?: Record<string, boolean>;

  @ApiPropertyOptional({
    description: 'Frequency per event type',
    example: { course_update: 'daily', enrollment_confirmed: 'instant' },
  })
  @IsOptional()
  @IsObject()
  eventFrequency?: Record<string, 'instant' | 'daily' | 'weekly' | 'never'>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quietTimeStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quietTimeEnd?: string;
}

export class UnsubscribeDto {
  @ApiProperty({ description: 'Event type to unsubscribe from, or "all"' })
  @IsString()
  eventType: string;
}

export class SendTemplatedNotificationDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  templateName: string;

  @ApiPropertyOptional()
  @IsOptional()
  templateVersion?: number;

  @ApiProperty({ description: 'Event type for frequency and preference checks' })
  @IsString()
  eventType: string;

  @ApiProperty()
  @IsObject()
  context: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['instant', 'daily', 'weekly', 'never'] })
  @IsOptional()
  @IsIn(['instant', 'daily', 'weekly', 'never'])
  frequencyOverride?: 'instant' | 'daily' | 'weekly' | 'never';
}
