import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SortOrder, CursorDirection } from './pagination.dto';

const MOBILE_MAX_PAGE_SIZE = 20;
const MOBILE_DEFAULT_PAGE_SIZE = 10;

export class MobilePaginationQueryDto {
  @ApiPropertyOptional({ description: 'Cursor for pagination (opaque token)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of items per page (mobile optimized)',
    example: MOBILE_DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MOBILE_MAX_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MOBILE_MAX_PAGE_SIZE, { message: `Mobile page size cannot exceed ${MOBILE_MAX_PAGE_SIZE}` })
  limit?: number = MOBILE_DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ description: 'Field to sort by', example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: SortOrder, example: SortOrder.DESC })
  @IsOptional()
  @IsIn([SortOrder.ASC, SortOrder.DESC])
  order?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Cursor direction',
    enum: CursorDirection,
    example: CursorDirection.FORWARD,
  })
  @IsOptional()
  @IsIn([CursorDirection.FORWARD, CursorDirection.BACKWARD])
  direction?: CursorDirection = CursorDirection.FORWARD;

  @ApiPropertyOptional({ description: 'Search term for full-text search', example: 'javascript' })
  @IsOptional()
  @IsString()
  search?: string;
}
