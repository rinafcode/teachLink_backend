import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { SortOrder, CursorDirection } from './pagination.dto';

const MOBILE_MAX_PAGE_SIZE = 20;
const MOBILE_DEFAULT_PAGE_SIZE = 10;

/**
 * Defines the mobile optimized cursor Pagination Query payload.
 * Enforces smaller payload sizes for mobile apps.
 */
export class MobilePaginationQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MOBILE_MAX_PAGE_SIZE, { message: `Mobile page size cannot exceed ${MOBILE_MAX_PAGE_SIZE}` })
  limit?: number = MOBILE_DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsIn([SortOrder.ASC, SortOrder.DESC])
  order?: SortOrder = SortOrder.DESC;

  @IsOptional()
  @IsIn([CursorDirection.FORWARD, CursorDirection.BACKWARD])
  direction?: CursorDirection = CursorDirection.FORWARD;

  @IsOptional()
  @IsString()
  search?: string;
}
