import { IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetRecommendationsDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;
}

export class RecommendedCourseDto {
  id: string;
  title: string;
  description: string;
  category?: string;
  price: number;
  score: number;
  reason: 'collaborative' | 'content-based' | 'hybrid';
}
