import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { IncidentSeverity, IncidentStatus } from '../entities/incident.entity';

export class CreateIncidentDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

  @IsOptional()
  @IsObject()
  triggerMetrics?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  runbookId?: string;
}

export class UpdateIncidentDto {
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsString()
  escalatedTo?: string;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}

export class ResolveIncidentDto {
  @IsString()
  resolutionNotes: string;
}

export class EscalateIncidentDto {
  @IsString()
  escalatedTo: string;

  @IsString()
  reason: string;
}

export class IncidentResponseDto {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  triggerMetrics?: Record<string, unknown>;
  runbookId?: string;
  remediationActionIds?: string[];
  escalatedTo?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  detectedAt: Date;
  updatedAt: Date;
}

export class GetIncidentsQueryDto {
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsOptional()
  skip: number = 0;

  @IsOptional()
  take: number = 10;
}
