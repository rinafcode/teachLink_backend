import { IsBoolean, IsDate, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Matches, Min } from 'class-validator';

/**
 * DTO for creating a scheduled job
 */
export class CreateScheduledJobDto<T = any> {
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
  @IsNotEmpty()
  scheduledFor: Date;

  /**
   * Maximum number of retry attempts
   * Default: 3
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  maxAttempts?: number = 3;
}

/**
 * DTO for creating a recurring job with cron expression
 */
export class CreateRecurringJobDto<T = any> {
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
   * Cron expression for job scheduling
   * Format: * * * * * (minute, hour, day of month, month, day of week)
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\*|\d+|\d+-\d+|\d+\/\d+|\d+,\d+) (\*|\d+|\d+-\d+|\d+\/\d+|\d+,\d+) (\*|\d+|\d+-\d+|\d+\/\d+|\d+,\d+) (\*|\d+|\d+-\d+|\d+\/\d+|\d+,\d+|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec) (\*|\d+|\d+-\d+|\d+\/\d+|\d+,\d+|sun|mon|tue|wed|thu|fri|sat)$/i, {
    message: 'Invalid cron expression format'
  })
  cronExpression: string;

  /**
   * Timezone for the cron expression
   * Default: UTC
   */
  @IsString()
  @IsOptional()
  timezone?: string = 'UTC';

  /**
   * Maximum number of retry attempts
   * Default: 3
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  maxAttempts?: number = 3;

  /**
   * Whether the recurring job is enabled
   * Default: true
   */
  @IsBoolean()
  @IsOptional()
  enabled?: boolean = true;

  /**
   * End date for the recurring job
   * If not provided, the job will run indefinitely
   */
  @IsDate()
  @IsOptional()
  endDate?: Date;
}

/**
 * DTO for updating a recurring job
 */
export class UpdateRecurringJobDto {
  /**
   * Data payload for the job
   */
  @IsObject()
  @IsOptional()
  data?: any;

  /**
   * Priority level of the job (higher number = higher priority)
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  priority?: number;

  /**
   * Cron expression for job scheduling
   * Format: * * * * * (minute, hour, day of month, month, day of week)
   */
  @IsString()
  @IsOptional()
  @Matches(/^(\*|\d+|\d+-\d+|\d+\/\d+|\d+,\d+) (\*|\d+|\d+-\d+|\d+\/\d+|\d+,\d+) (\*|\d+|\d+-\d+|\d+\/\d+|\d+,\d+) (\*|\d+|\d+-\d+|\d+\/\d+|\d+,\d+|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec) (\*|\d+|\d+-\d+|\d+\/\d+|\d+,\d+|sun|mon|tue|wed|thu|fri|sat)$/i, {
    message: 'Invalid cron expression format'
  })
  cronExpression?: string;

  /**
   * Timezone for the cron expression
   */
  @IsString()
  @IsOptional()
  timezone?: string;

  /**
   * Maximum number of retry attempts
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  maxAttempts?: number;

  /**
   * Whether the recurring job is enabled
   */
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  /**
   * End date for the recurring job
   */
  @IsDate()
  @IsOptional()
  endDate?: Date;
}