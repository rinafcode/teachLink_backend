import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { UserTier } from '../rate-limiting.constants';

export class CreateQuotaDefinitionDto {
  @ApiPropertyOptional({ enum: UserTier, description: 'Tier this rule applies to' })
  @IsOptional()
  @IsEnum(UserTier)
  tier?: UserTier;

  @ApiPropertyOptional({ description: 'User-specific override (UUID)' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ example: 10, description: 'Max requests per minute' })
  @IsInt()
  @Min(1)
  requestsPerMinute: number;

  @ApiProperty({ example: 100, description: 'Max requests per hour' })
  @IsInt()
  @Min(1)
  requestsPerHour: number;

  @ApiProperty({ example: 500, description: 'Max requests per day' })
  @IsInt()
  @Min(1)
  requestsPerDay: number;
}

export class UpdateQuotaDefinitionDto {
  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  requestsPerMinute?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  requestsPerHour?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  requestsPerDay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;
}

export class QuotaStatusDto {
  @ApiProperty() userId: string;
  @ApiProperty({ enum: UserTier }) tier: UserTier;
  @ApiProperty() minuteUsed: number;
  @ApiProperty() minuteLimit: number;
  @ApiProperty() hourUsed: number;
  @ApiProperty() hourLimit: number;
  @ApiProperty() dayUsed: number;
  @ApiProperty() dayLimit: number;
  @ApiProperty() isBlocked: boolean;
  @ApiProperty() nextResetAt: Date;
}

export class ResetUserQuotaDto {
  @ApiProperty({ description: 'User ID to reset quota for' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ enum: ['MINUTELY', 'HOURLY', 'DAILY'] })
  @IsOptional()
  @IsString()
  period?: 'MINUTELY' | 'HOURLY' | 'DAILY';
}
