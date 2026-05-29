import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsUUID,
} from 'class-validator';
import {
  RemediationStatus,
} from '../entities/remediation-action.entity';

export class CreateRemediationActionDto {
  @IsUUID()
  incidentId: string;

  @IsString()
  actionType: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;

  @IsOptional()
  autoRollback?: boolean;
}

export class UpdateRemediationActionDto {
  @IsOptional()
  @IsEnum(RemediationStatus)
  status?: RemediationStatus;

  @IsOptional()
  @IsString()
  executionOutput?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}

export class RemediationActionResponseDto {
  id: string;
  incidentId: string;
  actionType: string;
  description: string;
  status: RemediationStatus;
  parameters?: Record<string, unknown>;
  executedAt?: Date;
  executionOutput?: string;
  errorMessage?: string;
  autoRollback: boolean;
  rolledBackAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
