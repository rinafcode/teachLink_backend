import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCohortDto {
  @ApiProperty({ example: 'JavaScript Learners' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'A collaborative cohort for beginner JavaScript students.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/images/js-cohort.png' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/images/js-cohort-banner.png' })
  @IsString()
  @IsOptional()
  bannerUrl?: string;
}
