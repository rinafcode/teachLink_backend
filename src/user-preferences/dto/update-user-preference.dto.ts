import { IsOptional, IsEnum, IsBoolean, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppTheme, AppLanguage } from '../entities/user-preference.entity';

export class UpdateUserPreferenceDto {
  @ApiPropertyOptional({ enum: AppTheme })
  @IsOptional()
  @IsEnum(AppTheme)
  theme?: AppTheme;

  @ApiPropertyOptional({ enum: AppLanguage })
  @IsOptional()
  @IsEnum(AppLanguage)
  language?: AppLanguage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inAppNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  courseUpdates?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  weeklyDigest?: boolean;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  customSettings?: Record<string, unknown>;
}
