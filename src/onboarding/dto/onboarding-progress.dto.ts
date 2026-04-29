import { IsNumber, IsOptional, IsObject, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProgressDto {
  @ApiProperty({ example: 50, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpentSeconds?: number;

  @ApiPropertyOptional({
    type: 'object',
    example: { lastViewedSection: 'introduction', attempts: 2 },
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    lastViewedSection?: string;
    attempts?: number;
    quizScore?: number;
  };
}

export class CompleteStepDto {
  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpentSeconds?: number;

  @ApiPropertyOptional({
    type: 'object',
    example: { quizScore: 95 },
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    lastViewedSection?: string;
    attempts?: number;
    quizScore?: number;
  };
}
