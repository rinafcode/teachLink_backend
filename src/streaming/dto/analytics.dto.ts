import { IsString, IsNotEmpty, IsOptional, IsNumber, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for analytics metric
 */
export class AnalyticsMetricDto<T = any> {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  value: T;

  @IsNumber()
  timestamp: number;

  @IsOptional()
  @IsObject()
  dimensions?: Record<string, string>;
}

/**
 * DTO for time window configuration
 */
export class TimeWindowConfigDto {
  @IsNumber()
  @IsNotEmpty()
  windowSizeMs: number;

  @IsOptional()
  @IsNumber()
  slidingIntervalMs?: number;

  @IsOptional()
  @IsString()
  aggregationKey?: string;
}

/**
 * DTO for time window aggregation result
 */
export class TimeWindowAggregationDto {
  @IsNumber()
  windowStart: number;

  @IsNumber()
  windowEnd: number;

  @IsNumber()
  count: number;

  @IsOptional()
  @IsNumber()
  sum?: number;

  @IsOptional()
  @IsNumber()
  avg?: number;

  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;

  @IsObject()
  metrics: Record<string, any>;
}

/**
 * DTO for anomaly detection configuration
 */
export class AnomalyDetectionConfigDto {
  @IsString()
  @IsNotEmpty()
  metricName: string;

  @IsNumber()
  @IsNotEmpty()
  threshold: number;

  @IsString()
  @IsNotEmpty()
  comparator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';

  @IsOptional()
  @IsNumber()
  sensitivityFactor?: number;
}

/**
 * DTO for anomaly detection result
 */
export class AnomalyDetectionResultDto {
  @IsString()
  @IsNotEmpty()
  metricName: string;

  @IsNumber()
  timestamp: number;

  @IsNotEmpty()
  value: any;

  @IsNumber()
  @IsNotEmpty()
  threshold: number;

  @IsString()
  @IsNotEmpty()
  severity: 'low' | 'medium' | 'high' | 'critical';

  @IsOptional()
  @IsString()
  message?: string;
}