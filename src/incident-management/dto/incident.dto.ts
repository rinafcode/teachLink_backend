import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentSeverity, IncidentStatus } from '../entities/incident.entity';

export class CreateIncidentDto {
  @ApiProperty({ description: 'Incident title', example: 'High error rate on payment endpoint' })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Detailed description of the incident',
    example: 'Error rate exceeded 5% threshold on /api/v1/payments',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Incident severity level',
    enum: IncidentSeverity,
    example: 'critical',
  })
  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

  @ApiPropertyOptional({ description: 'Trigger metrics that caused the incident' })
  @IsOptional()
  @IsObject()
  triggerMetrics?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Associated runbook ID' })
  @IsOptional()
  @IsString()
  runbookId?: string;
}

export class UpdateIncidentDto {
  @ApiPropertyOptional({ description: 'Updated incident status', enum: IncidentStatus })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiPropertyOptional({ description: 'User/team the incident was escalated to' })
  @IsOptional()
  @IsString()
  escalatedTo?: string;

  @ApiPropertyOptional({ description: 'Resolution notes' })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}

export class ResolveIncidentDto {
  @ApiProperty({ description: 'Resolution notes explaining how the incident was resolved' })
  @IsString()
  resolutionNotes: string;
}

export class EscalateIncidentDto {
  @ApiProperty({ description: 'User or team to escalate to' })
  @IsString()
  escalatedTo: string;

  @ApiProperty({ description: 'Reason for escalation' })
  @IsString()
  reason: string;
}

export class IncidentResponseDto {
  @ApiProperty({ description: 'Incident ID' })
  id: string;

  @ApiProperty({ description: 'Incident title' })
  title: string;

  @ApiProperty({ description: 'Incident description' })
  description: string;

  @ApiProperty({ description: 'Current status', enum: IncidentStatus })
  status: IncidentStatus;

  @ApiProperty({ description: 'Severity level', enum: IncidentSeverity })
  severity: IncidentSeverity;

  @ApiPropertyOptional({ description: 'Trigger metrics' })
  triggerMetrics?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Associated runbook ID' })
  runbookId?: string;

  @ApiPropertyOptional({ description: 'Remediation action IDs' })
  remediationActionIds?: string[];

  @ApiPropertyOptional({ description: 'Escalated to' })
  escalatedTo?: string;

  @ApiPropertyOptional({ description: 'Resolution timestamp' })
  resolvedAt?: Date;

  @ApiPropertyOptional({ description: 'Resolution notes' })
  resolutionNotes?: string;

  @ApiProperty({ description: 'Detection timestamp' })
  detectedAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class GetIncidentsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: IncidentStatus })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiPropertyOptional({ description: 'Filter by severity', enum: IncidentSeverity })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @ApiPropertyOptional({ description: 'Number of records to skip', example: 0 })
  @IsOptional()
  skip: number = 0;

  @ApiPropertyOptional({ description: 'Number of records to take', example: 10 })
  @IsOptional()
  take: number = 10;
}
