import { CreateCourseDto } from './create-course.dto';
import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { CourseStatus } from '../entities/course.entity';

/**
 * Defines the update Course payload.
 */
export class UpdateCourseDto extends PartialType(CreateCourseDto) {
  @ApiPropertyOptional({ enum: CourseStatus })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @ApiPropertyOptional({
    description:
      'ID of the prerequisite course that must be completed before enrolling in this course',
  })
  @IsUUID('4', { message: 'Prerequisite course ID must be a valid UUID' })
  @IsOptional()
  prerequisiteCourseId?: string;
}
