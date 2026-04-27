export interface ILogContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  requestId?: string;
  service: string;
  environment: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IStructuredLog {
  level: LogLevel;
  message: string;
  context: ILogContext;
  error?: IErrorDetails;
  duration?: number;
  tags?: string[];
}

export interface IErrorDetails {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  statusCode?: number;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export interface IMetricData {
  name: string;
  value: number;
  type: MetricType;
  tags?: Record<string, string>;
  timestamp: Date;
}

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

export interface ITraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: SpanStatus;
  attributes: Record<string, any>;
  events: ISpanEvent[];
}

export enum SpanStatus {
  OK = 'ok',
  ERROR = 'error',
  UNSET = 'unset',
}

export interface ISpanEvent {
  name: string;
  timestamp: Date;
  attributes?: Record<string, any>;
}

export interface IAnomalyDetectionResult {
  isAnomaly: boolean;
  score: number;
  threshold: number;
  metric: string;
  timestamp: Date;
  details?: string;
}

export interface ILogQuery {
  level?: LogLevel;
  service?: string;
  correlationId?: string;
  userId?: string;
  startTime?: Date;
  endTime?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ILogSearchResult {
  logs: IStructuredLog[];
  total: number;
  page: number;
  pageSize: number;
}
