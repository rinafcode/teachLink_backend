import { IsString, IsEnum, IsOptional, IsUUID, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RunbookExecutionStatus } from '../entities/runbook-execution.entity';

export class CreateRunbookExecutionDto {
  @ApiProperty({ description: 'Associated incident ID' })
  @IsUUID()
  incidentId: string;

  @ApiProperty({ description: 'Name of the runbook', example: 'Payment Service Recovery' })
  @IsString()
  runbookName: string;

  @ApiProperty({
    description: 'Path to the runbook definition',
    example: '/runbooks/payment-recovery.yaml',
  })
  @IsString()
  runbookPath: string;
}

export class UpdateRunbookExecutionDto {
  @ApiPropertyOptional({ description: 'Execution status', enum: RunbookExecutionStatus })
  @IsOptional()
  @IsEnum(RunbookExecutionStatus)
  status?: RunbookExecutionStatus;

  @ApiPropertyOptional({ description: 'Step execution results' })
  @IsOptional()
  @IsArray()
  stepExecutions?: Array<{
    stepNumber: number;
    stepName: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    output?: string;
    error?: string;
  }>;

  @ApiPropertyOptional({ description: 'Summary of the execution' })
  @IsOptional()
  @IsString()
  executionSummary?: string;

  @ApiPropertyOptional({ description: 'Error details if execution failed' })
  @IsOptional()
  @IsString()
  errorDetails?: string;
}

export class RunbookExecutionResponseDto {
  @ApiProperty({ description: 'Execution ID' })
  id: string;

  @ApiProperty({ description: 'Incident ID' })
  incidentId: string;

  @ApiProperty({ description: 'Runbook name', example: 'Payment Service Recovery' })
  runbookName: string;

  @ApiProperty({ description: 'Runbook path', example: '/runbooks/payment-recovery.yaml' })
  runbookPath: string;

  @ApiProperty({ description: 'Execution status', enum: RunbookExecutionStatus })
  status: RunbookExecutionStatus;

  @ApiPropertyOptional({ description: 'Start timestamp' })
  startedAt?: Date;

  @ApiPropertyOptional({ description: 'Completion timestamp' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Step execution results' })
  stepExecutions?: Array<{
    stepNumber: number;
    stepName: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    output?: string;
    error?: string;
  }>;

  @ApiPropertyOptional({ description: 'Execution summary' })
  executionSummary?: string;

  @ApiPropertyOptional({ description: 'Error details' })
  errorDetails?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
