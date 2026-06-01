import { IsString, IsEnum, IsOptional, IsUUID, IsArray } from 'class-validator';
import { RunbookExecutionStatus } from '../entities/runbook-execution.entity';

export class CreateRunbookExecutionDto {
  @IsUUID()
  incidentId: string;

  @IsString()
  runbookName: string;

  @IsString()
  runbookPath: string;
}

export class UpdateRunbookExecutionDto {
  @IsOptional()
  @IsEnum(RunbookExecutionStatus)
  status?: RunbookExecutionStatus;

  @IsOptional()
  @IsArray()
  stepExecutions?: Array<{
    stepNumber: number;
    stepName: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    output?: string;
    error?: string;
  }>;

  @IsOptional()
  @IsString()
  executionSummary?: string;

  @IsOptional()
  @IsString()
  errorDetails?: string;
}

export class RunbookExecutionResponseDto {
  id: string;
  incidentId: string;
  runbookName: string;
  runbookPath: string;
  status: RunbookExecutionStatus;
  startedAt?: Date;
  completedAt?: Date;
  stepExecutions?: Array<{
    stepNumber: number;
    stepName: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    output?: string;
    error?: string;
  }>;
  executionSummary?: string;
  errorDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}
