import { IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetRecommendationsDto {
  @ApiProperty({ description: 'User ID to get recommendations for' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({
    description: 'Number of recommendations to return',
    minimum: 1,
    maximum: 50,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;
}

export class RecommendedCourseDto {
  @ApiProperty({ description: 'Course ID' })
  id: string;

  @ApiProperty({ description: 'Course title', example: 'Introduction to JavaScript' })
  title: string;

  @ApiProperty({ description: 'Course description' })
  description: string;

  @ApiPropertyOptional({ description: 'Course category', example: 'Programming' })
  category?: string;

  @ApiProperty({ description: 'Course price', example: 49.99 })
  price: number;

  @ApiProperty({ description: 'Recommendation score', example: 0.95 })
  score: number;

  @ApiProperty({
    description: 'Recommendation reason',
    enum: ['collaborative', 'content-based', 'hybrid'],
  })
  reason: 'collaborative' | 'content-based' | 'hybrid';
}
