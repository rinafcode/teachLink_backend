import { IsOptional, IsString, IsInt, Min, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertRewardDto {
  @ApiProperty({ description: 'Reward title', example: 'Gold Badge' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Reward description', example: 'Awarded for reaching Gold tier' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Associated badge ID' })
  @IsOptional()
  @IsString()
  badgeId?: string;

  @ApiPropertyOptional({ description: 'Bonus points awarded', example: 500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  bonusPoints?: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
