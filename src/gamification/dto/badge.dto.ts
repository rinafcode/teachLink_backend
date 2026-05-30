import { IsEnum, IsOptional, IsInt, Min, IsBoolean, IsString, IsUrl } from 'class-validator';
import { BadgeCategory } from '../enums/badge-category.enum';
import { BadgeCriteriaType } from '../enums/badge-criteria-type.enum';

export class CreateBadgeDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsEnum(BadgeCategory)
  category: BadgeCategory;

  @IsEnum(BadgeCriteriaType)
  criteriaType: BadgeCriteriaType;

  criteriaValue: Record<string, any>;

  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  points?: number;
}

export class BadgeFilterDto {
  @IsOptional()
  @IsEnum(BadgeCategory)
  category?: BadgeCategory;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class LeaderboardQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsEnum(BadgeCategory)
  category?: BadgeCategory;
}
