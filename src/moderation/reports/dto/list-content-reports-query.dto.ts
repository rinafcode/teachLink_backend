import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { APP_CONSTANTS } from '../../../common/constants/app.constants';
import { ContentReportReason } from '../content-report-reason.enum';
import { ContentReportStatus } from '../content-report-status.enum';

const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = APP_CONSTANTS;

/**
 * Validated pagination DTO for the content-reports list endpoint.
 *
 * Enforces a sane maximum page size so a client cannot request an unbounded
 * number of rows, and rejects invalid values (negative, zero, non-numeric,
 * over-max) with a 400 via the global ValidationPipe.
 *
 * - Default page size: {@link DEFAULT_PAGE_SIZE} (10)
 * - Maximum page size: {@link MAX_PAGE_SIZE} (100)
 */
export class ListContentReportsQueryDto {
  @ApiPropertyOptional({
    enum: ContentReportStatus,
    description: 'Filter reports by moderation status.',
  })
  @IsEnum(ContentReportStatus)
  @IsOptional()
  status?: ContentReportStatus;

  @ApiPropertyOptional({
    enum: ContentReportReason,
    description: 'Filter reports by reason.',
  })
  @IsEnum(ContentReportReason)
  @IsOptional()
  reason?: ContentReportReason;

  @ApiPropertyOptional({
    description: 'Filter reports by content type.',
    example: 'course',
  })
  @IsString()
  @IsOptional()
  contentType?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: `Number of items per page (1–${MAX_PAGE_SIZE})`,
    example: DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE, { message: `Page size cannot exceed ${MAX_PAGE_SIZE}` })
  limit?: number = DEFAULT_PAGE_SIZE;
}
