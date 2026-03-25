import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

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
