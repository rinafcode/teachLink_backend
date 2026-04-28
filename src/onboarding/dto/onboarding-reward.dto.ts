import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean, IsObject, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RewardType } from '../entities/onboarding-reward.entity';

export class CreateOnboardingRewardDto {
  @ApiProperty({ example: 'Completion Bonus' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Awarded for completing all onboarding steps' })
  @IsString()
  description: string;

  @ApiProperty({ enum: RewardType })
  @IsEnum(RewardType)
  type: RewardType;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsValue?: number;

  @ApiPropertyOptional({ example: 'badge-456' })
  @IsOptional()
  @IsString()
  badgeId?: string;

  @ApiPropertyOptional({ example: 'WELCOME20' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({
    type: 'object',
    example: { discountPercentage: 20, expiryDate: '2025-12-31' },
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    certificateTemplate?: string;
    discountPercentage?: number;
    expiryDate?: Date;
  };

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0)
  requiredSteps: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOnboardingRewardDto {
  @ApiPropertyOptional({ example: 'Completion Bonus' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Awarded for completing all onboarding steps' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: RewardType })
  @IsOptional()
  @IsEnum(RewardType)
  type?: RewardType;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsValue?: number;

  @ApiPropertyOptional({ example: 'badge-456' })
  @IsOptional()
  @IsString()
  badgeId?: string;

  @ApiPropertyOptional({ example: 'WELCOME20' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({
    type: 'object',
    example: { discountPercentage: 20, expiryDate: '2025-12-31' },
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    certificateTemplate?: string;
    discountPercentage?: number;
    expiryDate?: Date;
  };

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  requiredSteps?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
