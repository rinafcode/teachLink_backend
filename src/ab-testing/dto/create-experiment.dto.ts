import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ICreateExperimentDto, ICreateMetricDto, ICreateVariantDto } from '../ab-testing.service';
import { ExperimentType } from '../entities/experiment.entity';

/**
 * Variant payload used when creating or updating an experiment.
 */
export class CreateVariantDto implements ICreateVariantDto {
  @ApiProperty({ description: 'Name of the variant.', example: 'Variant A' })
  @IsString({ message: 'Variant name must be a string' })
  @IsNotEmpty({ message: 'Variant name is required' })
  name: string;

  @ApiProperty({ description: 'Description of the variant.', example: 'Control variant with baseline UI.' })
  @IsString({ message: 'Variant description must be a string' })
  @IsNotEmpty({ message: 'Variant description is required' })
  description: string;

  @ApiProperty({ description: 'Configuration payload for the variant.', example: { buttonColor: 'blue' } })
  @IsObject({ message: 'Variant configuration must be an object' })
  configuration: Record<string, unknown>;

  @ApiProperty({ description: 'Whether this variant is the control variant.', example: true })
  @IsBoolean({ message: 'isControl must be a boolean' })
  isControl: boolean;
}

/**
 * Metric payload used when creating or updating an experiment.
 */
export class CreateMetricDto implements ICreateMetricDto {
  @ApiProperty({ description: 'Human readable metric name.', example: 'Click-through rate' })
  @IsString({ message: 'Metric name must be a string' })
  @IsNotEmpty({ message: 'Metric name is required' })
  name: string;

  @ApiProperty({ description: 'Metric description.', example: 'Track how many users click the CTA.' })
  @IsString({ message: 'Metric description must be a string' })
  @IsNotEmpty({ message: 'Metric description is required' })
  description: string;

  @ApiProperty({ description: 'Metric type used for analysis.', example: 'conversion' })
  @IsString({ message: 'Metric type must be a string' })
  @IsNotEmpty({ message: 'Metric type is required' })
  type: string;

  @ApiProperty({ description: 'Whether this metric is the primary success metric.', example: true })
  @IsBoolean({ message: 'isPrimary must be a boolean' })
  isPrimary: boolean;

  @ApiPropertyOptional({ description: 'Optional configuration for the metric.' })
  @IsOptional()
  @IsObject({ message: 'Metric configuration must be an object' })
  configuration?: Record<string, unknown>;
}

/**
 * Request DTO for creating a new A/B test experiment.
 */
export class CreateExperimentDto implements ICreateExperimentDto {
  @ApiProperty({ description: 'Experiment name.', example: 'Homepage CTA test' })
  @IsString({ message: 'Experiment name must be a string' })
  @IsNotEmpty({ message: 'Experiment name is required' })
  name: string;

  @ApiProperty({ description: 'Experiment description.', example: 'Compare two button labels.' })
  @IsString({ message: 'Experiment description must be a string' })
  @IsNotEmpty({ message: 'Experiment description is required' })
  description: string;

  @ApiProperty({ description: 'Type of experiment.', enum: ExperimentType })
  @IsEnum(ExperimentType, { message: 'Experiment type is invalid' })
  type: ExperimentType;

  @ApiProperty({ description: 'Start date for the experiment.' })
  @Type(() => Date)
  @IsDate({ message: 'Start date must be a valid date' })
  startDate: Date;

  @ApiPropertyOptional({ description: 'Optional end date for the experiment.' })
  @Type(() => Date)
  @IsOptional()
  @IsDate({ message: 'End date must be a valid date' })
  endDate?: Date;

  @ApiProperty({ description: 'Percentage of traffic to allocate to the experiment.', example: 50 })
  @IsNumber({}, { message: 'Traffic allocation must be a number' })
  trafficAllocation: number;

  @ApiProperty({ description: 'Whether the experiment may automatically reallocate traffic.', example: false })
  @IsBoolean({ message: 'autoAllocateTraffic must be a boolean' })
  autoAllocateTraffic: boolean;

  @ApiProperty({ description: 'Confidence threshold target for the experiment.', example: 95 })
  @IsNumber({}, { message: 'Confidence level must be a number' })
  confidenceLevel: number;

  @ApiProperty({ description: 'Minimum sample size required for valid results.', example: 1000 })
  @IsNumber({}, { message: 'Minimum sample size must be a number' })
  minimumSampleSize: number;

  @ApiProperty({ description: 'Hypothesis statement for the experiment.', example: 'Changing the CTA text increases conversions.' })
  @IsString({ message: 'Hypothesis must be a string' })
  @IsNotEmpty({ message: 'Hypothesis is required' })
  hypothesis: string;

  @ApiPropertyOptional({ description: 'Targeting criteria object for the experiment.' })
  @IsOptional()
  @IsObject({ message: 'Targeting criteria must be an object' })
  targetingCriteria?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Exclusion criteria object for the experiment.' })
  @IsOptional()
  @IsObject({ message: 'Exclusion criteria must be an object' })
  exclusionCriteria?: Record<string, unknown>;

  @ApiProperty({ description: 'Variants included in the experiment.', type: [CreateVariantDto] })
  @IsArray({ message: 'Variants must be an array' })
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants: CreateVariantDto[];

  @ApiProperty({ description: 'Metrics used to evaluate the experiment.', type: [CreateMetricDto] })
  @IsArray({ message: 'Metrics must be an array' })
  @ValidateNested({ each: true })
  @Type(() => CreateMetricDto)
  metrics: CreateMetricDto[];
}
