import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppLanguage, AppTheme } from '../entities/user-preference.entity';

/**
 * Typed response shape for user-preferences endpoints so the generated
 * Swagger schemas render accurately.
 */
export class UserPreferenceResponseDto {
  @ApiProperty({ description: 'Preference record UUID' })
  id: string;

  @ApiProperty({ description: 'User the preferences belong to' })
  userId: string;

  @ApiProperty({ enum: AppTheme, description: 'UI theme preference' })
  theme: AppTheme;

  @ApiProperty({ enum: AppLanguage, description: 'UI language preference' })
  language: AppLanguage;

  @ApiPropertyOptional({
    description: 'Locale used for number/date formatting',
    example: 'en-US',
  })
  locale?: string;

  @ApiPropertyOptional({
    description: 'IANA timezone identifier',
    example: 'UTC',
  })
  timezone?: string;

  @ApiPropertyOptional({ description: 'Preferred currency code', example: 'USD' })
  currency?: string;

  @ApiProperty({ description: 'Receive email notifications' })
  emailNotifications: boolean;

  @ApiProperty({ description: 'Receive push notifications' })
  pushNotifications: boolean;

  @ApiProperty({ description: 'Receive in-app notifications' })
  inAppNotifications: boolean;

  @ApiProperty({ description: 'Receive marketing emails' })
  marketingEmails: boolean;

  @ApiProperty({ description: 'Receive course updates' })
  courseUpdates: boolean;

  @ApiProperty({ description: 'Receive the weekly digest' })
  weeklyDigest: boolean;

  @ApiPropertyOptional({
    description: 'Advanced custom settings',
    type: Object,
  })
  customSettings?: Record<string, unknown>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
