import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsEnum, IsOptional } from 'class-validator';
import { ExperimentStatus, ExperimentType } from '../entities/experiment.entity';

/**
 * Filter set for A/B testing dashboard summary queries.
 */
export class DashboardFiltersDto {
  @ApiPropertyOptional({ description: 'Experiment status to filter by.', enum: ExperimentStatus })
  @IsOptional()
  @IsEnum(ExperimentStatus, { message: 'Status must be a valid experiment status' })
  status?: ExperimentStatus;

  @ApiPropertyOptional({ description: 'Experiment type to filter by.', enum: ExperimentType })
  @IsOptional()
  @IsEnum(ExperimentType, { message: 'Type must be a valid experiment type' })
  type?: ExperimentType;

  @ApiPropertyOptional({ description: 'Start date range filter for experiments.' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Start date must be a valid date' })
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date range filter for experiments.' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'End date must be a valid date' })
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Include archived experiments in dashboard results.',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'includeArchived must be a boolean' })
  includeArchived?: boolean;
}
