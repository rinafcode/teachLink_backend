import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Alert types for queue monitoring
 */
export enum AlertType {
  HIGH_ERROR_RATE = 'high_error_rate',
  QUEUE_STALLED = 'queue_stalled',
  JOB_TIMEOUT = 'job_timeout',
  HIGH_LATENCY = 'high_latency',
  QUEUE_GROWTH = 'queue_growth',
  WORKER_FAILURE = 'worker_failure'
}

/**
 * DTO for configuring queue monitoring thresholds
 */
export class MonitoringConfigDto {
  /**
   * Maximum acceptable error rate percentage
   * Default: 5
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  maxErrorRate?: number = 5;

  /**
   * Maximum acceptable latency in milliseconds
   * Default: 5000
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  maxLatency?: number = 5000;

  /**
   * Maximum acceptable queue size
   * Default: 1000
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  maxQueueSize?: number = 1000;

  /**
   * Minimum acceptable throughput (jobs per second)
   * Default: 1
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  minThroughput?: number = 1;

  /**
   * Maximum time in milliseconds a job can be stuck in active state
   * Default: 30000
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  stalledJobTimeout?: number = 30000;

  /**
   * Whether to enable alerts
   * Default: true
   */
  @IsBoolean()
  @IsOptional()
  alertsEnabled?: boolean = true;
}

/**
 * DTO for creating an alert
 */
export class CreateAlertDto {
  /**
   * Type of alert
   */
  @IsEnum(AlertType)
  @IsNotEmpty()
  type: AlertType;

  /**
   * Severity level of the alert
   */
  @IsEnum(AlertSeverity)
  @IsNotEmpty()
  severity: AlertSeverity;

  /**
   * Message describing the alert
   */
  @IsString()
  @IsNotEmpty()
  message: string;

  /**
   * Queue name that triggered the alert
   */
  @IsString()
  @IsNotEmpty()
  queueName: string;

  /**
   * Additional data related to the alert
   */
  @IsOptional()
  data?: any;
}

/**
 * DTO for alert query parameters
 */
export class AlertQueryDto {
  /**
   * Filter by alert type
   */
  @IsEnum(AlertType)
  @IsOptional()
  type?: AlertType;

  /**
   * Filter by severity level
   */
  @IsEnum(AlertSeverity)
  @IsOptional()
  severity?: AlertSeverity;

  /**
   * Filter by queue name
   */
  @IsString()
  @IsOptional()
  queueName?: string;

  /**
   * Maximum number of alerts to return
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
}