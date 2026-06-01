import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Max, Min } from 'class-validator';
import { ContentReportReason } from '../content-report-reason.enum';
import { ContentReportStatus } from '../content-report-status.enum';

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
    description: 'Maximum number of reports to return.',
    example: 50,
  })
  @Type(() => Number)
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number;
}

