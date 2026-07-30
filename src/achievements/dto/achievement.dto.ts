import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { AchievementType, AchievementDifficulty } from '../entities/achievement.entity';

export class CreateAchievementDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  longDescription?: string;

  @IsString()
  @IsNotEmpty()
  iconUrl: string;

  @IsEnum(AchievementType)
  type: AchievementType;

  @IsEnum(AchievementDifficulty)
  difficulty: AchievementDifficulty;

  @IsNumber()
  pointsReward: number;

  @IsNumber()
  experienceReward: number;

  @IsOptional()
  criteria?: any;

  @IsOptional()
  progressConfig?: any;
}

export class UpdateAchievementDto extends PartialType(CreateAchievementDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}

export class AchievementResponseDto {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  iconUrl: string;
  type: AchievementType;
  difficulty: AchievementDifficulty;
  pointsReward: number;
  experienceReward: number;
  criteria: any;
  progressConfig: any;
  isActive: boolean;
  isHidden: boolean;
  unlockedBy?: number;
  createdAt: Date;
  updatedAt: Date;
}
