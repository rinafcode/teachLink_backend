import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { APP_CONSTANTS } from '../../common/constants/app.constants';

/**
 * Validated query DTO for the analytics events list endpoint.
 *
 * Bounds the page size so a client cannot request an unbounded number of rows
 * (a memory/DoS and performance risk) and rejects invalid pagination values
 * (negative, zero, non-numeric, over-max) with a 400 via the global
 * ValidationPipe.
 *
 * - Default page size: {@link ANALYTICS_DEFAULT_LIMIT}
 * - Maximum page size: {@link APP_CONSTANTS.MAX_PAGE_SIZE}
 */
export const ANALYTICS_DEFAULT_LIMIT = 50;

const { MAX_PAGE_SIZE } = APP_CONSTANTS;

export class GetEventsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by event type' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ description: 'Filter by event category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Start of the date range (ISO 8601)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End of the date range (ISO 8601)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description: `Maximum number of events to return (1–${MAX_PAGE_SIZE})`,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: ANALYTICS_DEFAULT_LIMIT,
    example: ANALYTICS_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE, { message: `limit cannot exceed ${MAX_PAGE_SIZE}` })
  limit: number = ANALYTICS_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of events to skip (offset-based pagination)',
    minimum: 0,
    default: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
