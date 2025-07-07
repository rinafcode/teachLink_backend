import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ReportType } from '../entities/content-report.entity';

export class CreateContentReportDto {
  @IsString()
  contentId: string;

  @IsString()
  contentType: string;

  @IsEnum(ReportType)
  reportType: ReportType;

  @IsString()
  description: string;

  @IsOptional()
  @IsObject()
  evidence?: Record<string, any>;
} 