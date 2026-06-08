import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AchievementResponseDto } from './achievement.dto';

export class AchievementProgressDto {
  @ApiProperty({ description: 'Progress ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Achievement ID' })
  @IsString()
  achievementId: string;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Current progress value' })
  @IsNumber()
  currentProgress: number;

  @ApiProperty({ description: 'Target progress value' })
  @IsNumber()
  targetProgress: number;

  @ApiProperty({ description: 'Percentage of completion (0-100)' })
  @IsNumber()
  percentageComplete: number;

  @ApiPropertyOptional({ description: 'Whether achievement is unlocked' })
  @IsOptional()
  @IsBoolean()
  isUnlocked?: boolean;

  @ApiPropertyOptional({ description: 'Last progress update timestamp' })
  @IsOptional()
  lastProgressUpdate?: Date;

  @ApiPropertyOptional({ description: 'Achievement details' })
  @IsOptional()
  achievement?: AchievementResponseDto;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: any;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UpdateAchievementProgressDto {
  @ApiPropertyOptional({ description: 'Current progress value' })
  @IsOptional()
  @IsNumber()
  currentProgress?: number;

  @ApiPropertyOptional({ description: 'Whether to mark as unlocked' })
  @IsOptional()
  @IsBoolean()
  isUnlocked?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: any;
}
