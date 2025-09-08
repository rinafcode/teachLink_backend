import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { JobStatus, RetryStrategy } from '../interfaces/job.interface';

/**
 * DTO for creating a new job
 */
export class CreateJobDto<T = any> {
  /**
   * Name of the job type
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Data payload for the job
   */
  @IsObject()
  data: T;

  /**
   * Priority level of the job (higher number = higher priority)
   * Default: 0
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  priority?: number = 0;

  /**
   * When the job should be processed
   */
  @IsDate()
  @IsOptional()
  scheduledFor?: Date;

  /**
   * Maximum number of retry attempts
   * Default: 3
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  maxAttempts?: number = 3;

  /**
   * Timeout in milliseconds
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  timeout?: number;

  /**
   * Retry strategy
   * Default: EXPONENTIAL
   */
  @IsEnum(RetryStrategy)
  @IsOptional()
  retryStrategy?: RetryStrategy = RetryStrategy.EXPONENTIAL;

  /**
   * Whether to remove the job when completed
   * Default: true
   */
  @IsOptional()
  removeOnComplete?: boolean = true;

  /**
   * Whether to remove the job when failed
   * Default: false
   */
  @IsOptional()
  removeOnFail?: boolean = false;
}

/**
 * DTO for updating an existing job
 */
export class UpdateJobDto {
  /**
   * Priority level of the job (higher number = higher priority)
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  priority?: number;

  /**
   * When the job should be processed
   */
  @IsDate()
  @IsOptional()
  scheduledFor?: Date;

  /**
   * Status of the job
   */
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;
}

/**
 * DTO for job query parameters
 */
export class JobQueryDto {
  /**
   * Job status filter
   */
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;

  /**
   * Maximum number of jobs to return
   * Default: 10
   */
  @IsNumber()
  @IsOptional()
  @Min(1)
  limit?: number = 10;

  /**
   * Offset for pagination
   * Default: 0
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  offset?: number = 0;

  /**
   * Filter by job name
   */
  @IsString()
  @IsOptional()
  name?: string;
}