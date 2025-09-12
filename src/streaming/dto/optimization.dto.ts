import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsBoolean } from 'class-validator';

/**
 * Enum for optimization strategy types
 */
export enum OptimizationStrategyType {
  THROTTLING = 'throttling',
  BUFFERING = 'buffering',
  BATCHING = 'batching',
  SAMPLING = 'sampling',
  ADAPTIVE = 'adaptive',
}

/**
 * DTO for stream performance metrics
 */
export class StreamPerformanceMetricsDto {
  @IsNumber()
  throughput: number; // events per second

  @IsNumber()
  latency: number; // milliseconds

  @IsNumber()
  backpressure: number; // 0-1 scale

  @IsNumber()
  bufferSize: number;

  @IsNumber()
  timestamp: number;
}

/**
 * DTO for optimization strategy configuration
 */
export class OptimizationStrategyConfigDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(OptimizationStrategyType)
  type: OptimizationStrategyType;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsNumber()
  @IsOptional()
  threshold?: number;

  @IsNumber()
  @IsOptional()
  interval?: number;

  @IsNumber()
  @IsOptional()
  bufferSize?: number;

  @IsNumber()
  @IsOptional()
  samplingRate?: number;
}

/**
 * DTO for stream monitoring configuration
 */
export class StreamMonitoringConfigDto {
  @IsNumber()
  @IsOptional()
  samplingInterval?: number;

  @IsBoolean()
  @IsOptional()
  enableThroughputMonitoring?: boolean;

  @IsBoolean()
  @IsOptional()
  enableLatencyMonitoring?: boolean;

  @IsBoolean()
  @IsOptional()
  enableBackpressureMonitoring?: boolean;

  @IsNumber()
  @IsOptional()
  metricsHistorySize?: number;
}

/**
 * DTO for optimization result
 */
export class OptimizationResultDto {
  @IsString()
  @IsNotEmpty()
  strategyApplied: string;

  @IsNumber()
  timestamp: number;

  @IsNumber()
  @IsOptional()
  throughputBefore?: number;

  @IsNumber()
  @IsOptional()
  throughputAfter?: number;

  @IsNumber()
  @IsOptional()
  latencyBefore?: number;

  @IsNumber()
  @IsOptional()
  latencyAfter?: number;

  @IsString()
  @IsOptional()
  message?: string;
}