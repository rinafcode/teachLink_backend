import { PartialType } from '@nestjs/swagger';
import { CreateCourseDto } from './create-course.dto';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCourseDto extends PartialType(CreateCourseDto) {
  @ApiPropertyOptional({ enum: ['draft', 'published', 'archived'] })
  @IsString()
  @IsOptional()
  @IsEnum(['draft', 'published', 'archived'])
  status?: string;
}
