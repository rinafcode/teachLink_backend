import { IsOptional, IsInt, Min, Max, IsString, IsIn, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { APP_CONSTANTS } from '../constants/app.constants';

const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = APP_CONSTANTS;

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum CursorDirection {
  FORWARD = 'forward',
  BACKWARD = 'backward',
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE, { message: `Page size cannot exceed ${MAX_PAGE_SIZE}` })
  @IsNumber()
  limit?: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ description: 'Field to sort by', example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', enum: SortOrder, example: SortOrder.DESC })
  @IsOptional()
  @IsIn([SortOrder.ASC, SortOrder.DESC])
  order?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({ description: 'Search term for full-text search', example: 'javascript' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CursorPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Cursor for pagination (opaque token)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE, { message: `Page size cannot exceed ${MAX_PAGE_SIZE}` })
  limit?: number = DEFAULT_PAGE_SIZE;

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
