import { CreateCourseDto } from './create-course.dto';
import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

/**
 * Defines the update Course payload.
 */
export class UpdateCourseDto extends PartialType(CreateCourseDto) {
    @ApiPropertyOptional({ enum: ['draft', 'published', 'archived'] })
    @IsString()
    @IsOptional()
    @IsEnum(['draft', 'published', 'archived'])
    status?: string;
}
