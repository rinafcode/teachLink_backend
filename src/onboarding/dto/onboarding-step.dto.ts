import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean, IsObject, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OnboardingStepType, OnboardingStepStatus } from '../entities/onboarding-step.entity';

export class CreateOnboardingStepDto {
  @ApiProperty({ example: 'profile-setup' })
  @IsString()
  slug: string;

  @ApiProperty({ example: 'Set Up Your Profile' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Complete your profile with basic information' })
  @IsString()
  description: string;

  @ApiProperty({ enum: OnboardingStepType })
  @IsEnum(OnboardingStepType)
  type: OnboardingStepType;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0)
  order: number;

  @ApiPropertyOptional({
    type: 'object',
    example: {
      videoUrl: 'https://example.com/tutorial.mp4',
      steps: ['Step 1', 'Step 2'],
    },
  })
  @IsOptional()
  @IsObject()
  content?: {
    videoUrl?: string;
    imageUrl?: string;
    steps?: string[];
    tips?: string[];
  };

  @ApiPropertyOptional({ enum: OnboardingStepStatus, example: 'active' })
  @IsOptional()
  @IsEnum(OnboardingStepStatus)
  status?: OnboardingStepStatus;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rewardPoints?: number;

  @ApiPropertyOptional({ example: 'badge-123' })
  @IsOptional()
  @IsString()
  rewardBadgeId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedDurationMinutes?: number;
}

export class UpdateOnboardingStepDto {
  @ApiPropertyOptional({ example: 'profile-setup' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: 'Set Up Your Profile' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Complete your profile with basic information' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: OnboardingStepType })
  @IsOptional()
  @IsEnum(OnboardingStepType)
  type?: OnboardingStepType;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    type: 'object',
    example: {
      videoUrl: 'https://example.com/tutorial.mp4',
      steps: ['Step 1', 'Step 2'],
    },
  })
  @IsOptional()
  @IsObject()
  content?: {
    videoUrl?: string;
    imageUrl?: string;
    steps?: string[];
    tips?: string[];
  };

  @ApiPropertyOptional({ enum: OnboardingStepStatus, example: 'active' })
  @IsOptional()
  @IsEnum(OnboardingStepStatus)
  status?: OnboardingStepStatus;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rewardPoints?: number;

  @ApiPropertyOptional({ example: 'badge-123' })
  @IsOptional()
  @IsString()
  rewardBadgeId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedDurationMinutes?: number;
}
