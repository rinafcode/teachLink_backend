import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { register, collectDefaultMetrics, Registry } from 'prom-client';
import { DistributedTracingService } from './tracing/distributed-tracing.service';
import { LogAggregationService } from './logging/log-aggregation.service';
import { MetricsAnalysisService } from './metrics/metrics-analysis.service';
import { AnomalyDetectionService } from './anomaly/anomaly-detection.service';
import { LogLevel } from './entities/log-entry.entity';
import { MetricType } from './entities/metric-entry.entity';

export interface ObservabilityConfig {
  serviceName: string;
  version: string;
  environment: string;
  enableTracing: boolean;
  enableMetrics: boolean;
  enableLogging: boolean;
  enableAnomalyDetection: boolean;
  metricsExportInterval: number;
  logLevel: LogLevel;
}

@Injectable()
export class ObservabilityService implements OnModuleInit {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly registry: Registry;
  private config: ObservabilityConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly tracingService: DistributedTracingService,
    private readonly loggingService: LogAggregationService,
    private readonly metricsService: MetricsAnalysisService,
    private readonly anomalyService: AnomalyDetectionService,
  ) {
    this.registry = register;
    this.initializeConfig();
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Observability Service');
    
    if (this.config.enableMetrics) {
      await this.initializeMetrics();
    }

    if (this.config.enableTracing) {
      await this.initializeTracing();
    }

    if (this.config.enableLogging) {
      await this.initializeLogging();
    }

    if (this.config.enableAnomalyDetection) {
      await this.initializeAnomalyDetection();
    }

    this.logger.log('Observability Service initialized successfully');
  }

  private initializeConfig(): void {
    this.config = {
      serviceName: this.configService.get<string>('OBSERVABILITY_SERVICE_NAME', 'teachlink-backend'),
      version: this.configService.get<string>('OBSERVABILITY_VERSION', '1.0.0'),
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      enableTracing: this.configService.get<boolean>('OBSERVABILITY_ENABLE_TRACING', true),
      enableMetrics: this.configService.get<boolean>('OBSERVABILITY_ENABLE_METRICS', true),
      enableLogging: this.configService.get<boolean>('OBSERVABILITY_ENABLE_LOGGING', true),
      enableAnomalyDetection: this.configService.get<boolean>('OBSERVABILITY_ENABLE_ANOMALY_DETECTION', true),
      metricsExportInterval: this.configService.get<number>('OBSERVABILITY_METRICS_INTERVAL', 15000),
      logLevel: this.configService.get<LogLevel>('OBSERVABILITY_LOG_LEVEL', LogLevel.INFO),
    };
  }

  private async initializeMetrics(): Promise<void> {
    // Collect default Node.js metrics
    collectDefaultMetrics({
      register: this.registry,
      prefix: `${this.config.serviceName}_`,
    });

    // Initialize custom metrics collection
    await this.metricsService.initialize(this.config);
    this.logger.log('Metrics collection initialized');
  }

  private async initializeTracing(): Promise<void> {
    await this.tracingService.initialize(this.config);
    this.logger.log('Distributed tracing initialized');
  }

  private async initializeLogging(): Promise<void> {
    await this.loggingService.initialize(this.config);
    this.logger.log('Log aggregation initialized');
  }

  private async initializeAnomalyDetection(): Promise<void> {
    await this.anomalyService.initialize(this.config);
    this.logger.log('Anomaly detection initialized');
  }

  /**
   * Get observability configuration
   */
  getConfig(): ObservabilityConfig {
    return { ...this.config };
  }

  /**
   * Get Prometheus metrics
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Create correlation ID for request tracking
   */
  generateCorrelationId(): string {
    return this.tracingService.generateCorrelationId();
  }

  /**
   * Start a new trace span
   */
  async startSpan(operationName: string, parentSpanId?: string, tags?: Record<string, any>) {
    return this.tracingService.startSpan(operationName, parentSpanId, tags);
  }

  /**
   * Log structured message
   */
  async log(level: LogLevel, message: string, context?: Record<string, any>, correlationId?: string) {
    return this.loggingService.log(level, message, context, correlationId);
  }

  /**
   * Record a custom metric
   */
  async recordMetric(
    name: string,
    value: number,
    type: MetricType,
    tags?: Record<string, any>,
    correlationId?: string
  ) {
    return this.metricsService.recordMetric(name, value, type, tags, correlationId);
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, any>;
    timestamp: Date;
  }> {
    const tracingHealth = await this.tracingService.getHealthStatus();
    const loggingHealth = await this.loggingService.getHealthStatus();
    const metricsHealth = await this.metricsService.getHealthStatus();
    const anomalyHealth = await this.anomalyService.getHealthStatus();

    const components = {
      tracing: tracingHealth,
      logging: loggingHealth,
      metrics: metricsHealth,
      anomalyDetection: anomalyHealth,
    };

    const allHealthy = Object.values(components).every(c => c.status === 'healthy');
    const anyUnhealthy = Object.values(components).some(c => c.status === 'unhealthy');

    const status = anyUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded';

    return {
      status,
      components,
      timestamp: new Date(),
    };
  }

  /**
   * Get observability statistics
   */
  async getObservabilityStats(): Promise<{
    traces: number;
    logs: number;
    metrics: number;
    anomalies: number;
    period: string;
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [traces, logs, metrics, anomalies] = await Promise.all([
      this.tracingService.getTraceCount(oneDayAgo, now),
      this.loggingService.getLogCount(oneDayAgo, now),
      this.metricsService.getMetricCount(oneDayAgo, now),
      this.anomalyService.getAnomalyCount(oneDayAgo, now),
    ]);

    return {
      traces,
      logs,
      metrics,
      anomalies,
      period: '24h',
    };
  }

  /**
   * Search across all observability data
   */
  async search(query: {
    text?: string;
    correlationId?: string;
    traceId?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    services?: string[];
  }): Promise<{
    traces: any[];
    logs: any[];
    metrics: any[];
    anomalies: any[];
  }> {
    const [traces, logs, metrics, anomalies] = await Promise.all([
      this.tracingService.searchTraces(query),
      this.loggingService.searchLogs(query),
      this.metricsService.searchMetrics(query),
      this.anomalyService.searchAnomalies(query),
    ]);

    return {
      traces,
      logs,
      metrics,
      anomalies,
    };
  }
}
