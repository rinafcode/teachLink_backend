import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto, CursorPaginationQueryDto } from '../../common/dto/pagination.dto';

/**
 * Defines the course Search payload.
 */
export class CourseSearchDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  maxPrice?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  instructorId?: string;
}

/**
 * Defines the cursor Course Search payload.
 */
export class CursorCourseSearchDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  maxPrice?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  instructorId?: string;
}
