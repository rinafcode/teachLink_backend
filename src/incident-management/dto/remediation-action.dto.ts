import { IsString, IsEnum, IsOptional, IsObject, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RemediationStatus } from '../entities/remediation-action.entity';

export class CreateRemediationActionDto {
  @ApiProperty({ description: 'Associated incident ID' })
  @IsUUID()
  incidentId: string;

  @ApiProperty({ description: 'Type of remediation action', example: 'restart_service' })
  @IsString()
  actionType: string;

  @ApiProperty({
    description: 'Description of the remediation action',
    example: 'Restart the payment service pod',
  })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Action parameters' })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Whether to auto-rollback on failure' })
  @IsOptional()
  autoRollback?: boolean;
}

export class UpdateRemediationActionDto {
  @ApiPropertyOptional({ description: 'Updated status', enum: RemediationStatus })
  @IsOptional()
  @IsEnum(RemediationStatus)
  status?: RemediationStatus;

  @ApiPropertyOptional({ description: 'Execution output log' })
  @IsOptional()
  @IsString()
  executionOutput?: string;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  @IsOptional()
  @IsString()
  errorMessage?: string;
}

export class RemediationActionResponseDto {
  @ApiProperty({ description: 'Action ID' })
  id: string;

  @ApiProperty({ description: 'Incident ID' })
  incidentId: string;

  @ApiProperty({ description: 'Action type', example: 'restart_service' })
  actionType: string;

  @ApiProperty({ description: 'Action description' })
  description: string;

  @ApiProperty({ description: 'Current status', enum: RemediationStatus })
  status: RemediationStatus;

  @ApiPropertyOptional({ description: 'Action parameters' })
  parameters?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Execution timestamp' })
  executedAt?: Date;

  @ApiPropertyOptional({ description: 'Execution output' })
  executionOutput?: string;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  errorMessage?: string;

  @ApiProperty({ description: 'Whether auto-rollback is enabled' })
  autoRollback: boolean;

  @ApiPropertyOptional({ description: 'Rollback timestamp' })
  rolledBackAt?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
