import { IsOptional, IsInt, Min, Max, IsString, IsIn, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { APP_CONSTANTS } from '../constants/app.constants';
const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = APP_CONSTANTS;
export enum SortOrder {
    ASC = 'ASC',
    DESC = 'DESC'
}
export enum CursorDirection {
    FORWARD = 'forward',
    BACKWARD = 'backward'
}

/**
 * Defines the pagination Query payload.
 */
export class PaginationQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsNumber()
    page?: number = 1;
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(MAX_PAGE_SIZE, { message: `Page size cannot exceed ${MAX_PAGE_SIZE}` })
    @IsNumber()
    limit?: number = DEFAULT_PAGE_SIZE;
    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';
    @IsOptional()
    @IsIn([SortOrder.ASC, SortOrder.DESC])
    order?: SortOrder = SortOrder.DESC;
    @IsOptional()
    @IsString()
    search?: string;
}

/**
 * Defines the cursor Pagination Query payload.
 */
export class CursorPaginationQueryDto {
    @IsOptional()
    @IsString()
    cursor?: string;
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(MAX_PAGE_SIZE, { message: `Page size cannot exceed ${MAX_PAGE_SIZE}` })
    limit?: number = DEFAULT_PAGE_SIZE;
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
