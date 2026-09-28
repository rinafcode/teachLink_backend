import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { APP_CONSTANTS } from '../../common/constants/app.constants';

/**
 * Validated pagination DTO for the gamification leaderboard list endpoint.
 *
 * Enforces a sane maximum page size so a client cannot request an unbounded
 * number of rows, and rejects invalid values (negative, zero, non-numeric,
 * over-max) with a 400 via the global ValidationPipe.
 *
 * - Default page size: {@link LEADERBOARD_DEFAULT_PAGE_SIZE}
 * - Maximum page size: {@link APP_CONSTANTS.MAX_PAGE_SIZE}
 */
export const LEADERBOARD_DEFAULT_PAGE_SIZE = 20;

const { MAX_PAGE_SIZE } = APP_CONSTANTS;

export class LeaderboardPaginationDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: `Items per page (1–${MAX_PAGE_SIZE})`,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: LEADERBOARD_DEFAULT_PAGE_SIZE,
    example: LEADERBOARD_DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE, { message: `pageSize cannot exceed ${MAX_PAGE_SIZE}` })
  pageSize: number = LEADERBOARD_DEFAULT_PAGE_SIZE;
}
