import { IsEnum, IsOptional, IsInt, Min, IsBoolean, IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BadgeCategory } from '../enums/badge-category.enum';
import { BadgeCriteriaType } from '../enums/badge-criteria-type.enum';

export class CreateBadgeDto {
  @ApiProperty({ description: 'Badge display name', example: 'Course Completer' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Badge description', example: 'Awarded for completing 10 courses' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Badge category', enum: BadgeCategory })
  @IsEnum(BadgeCategory)
  category: BadgeCategory;

  @ApiProperty({ description: 'Criteria type for earning the badge', enum: BadgeCriteriaType })
  @IsEnum(BadgeCriteriaType)
  criteriaType: BadgeCriteriaType;

  @ApiProperty({ description: 'Criteria configuration value' })
  criteriaValue: Record<string, any>;

  @ApiPropertyOptional({ description: 'Badge icon URL' })
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @ApiPropertyOptional({ description: 'Points awarded with badge', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  points?: number;
}

export class BadgeFilterDto {
  @ApiPropertyOptional({ description: 'Filter by badge category', enum: BadgeCategory })
  @IsOptional()
  @IsEnum(BadgeCategory)
  category?: BadgeCategory;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class LeaderboardQueryDto {
  @ApiPropertyOptional({ description: 'Number of results to return', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter leaderboard by category', enum: BadgeCategory })
  @IsOptional()
  @IsEnum(BadgeCategory)
  category?: BadgeCategory;
}
