import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
import { LogAggregationService } from './logging/log-aggregation.service';
import { DistributedTracingService } from './tracing/distributed-tracing.service';
import { MetricsAnalysisService } from './metrics/metrics-analysis.service';
import { AnomalyDetectionService } from './anomaly/anomaly-detection.service';
import { LogQuery, LogLevel } from './interfaces/observability.interfaces';

/**
 * Observability Controller
 * Provides REST API for observability features
 */
@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly observabilityService: ObservabilityService,
    private readonly logAggregation: LogAggregationService,
    private readonly tracing: DistributedTracingService,
    private readonly metrics: MetricsAnalysisService,
    private readonly anomalyDetection: AnomalyDetectionService,
  ) {}

  /**
   * Get observability dashboard
   */
  @Get('dashboard')
  async getDashboard() {
    return this.observabilityService.getObservabilityDashboard();
  }

  /**
   * Get system overview
   */
  @Get('overview')
  async getOverview() {
    return this.observabilityService.getSystemOverview();
  }

  /**
   * Search logs
   */
  @Post('logs/search')
  async searchLogs(@Body() query: LogQuery) {
    return this.logAggregation.searchLogs(query);
  }

  /**
   * Get logs by correlation ID
   */
  @Get('logs/correlation/:id')
  async getLogsByCorrelation(@Query('id') id: string) {
    return this.logAggregation.getLogsByCorrelationId(id);
  }

  /**
   * Get error logs
   */
  @Get('logs/errors')
  async getErrorLogs(@Query('limit') limit?: number) {
    return this.logAggregation.getErrorLogs(
      limit ? parseInt(limit.toString()) : 100,
    );
  }

  /**
   * Get log statistics
   */
  @Get('logs/statistics')
  async getLogStatistics(
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const timeRange =
      startTime && endTime
        ? { start: new Date(startTime), end: new Date(endTime) }
        : undefined;

    return this.logAggregation.getLogStatistics(timeRange);
  }

  /**
   * Get recent logs
   */
  @Get('logs/recent')
  async getRecentLogs(@Query('limit') limit?: number) {
    return this.logAggregation.getRecentLogs(
      limit ? parseInt(limit.toString()) : 100,
    );
  }

  /**
   * Get trace by ID
   */
  @Get('traces/:id')
  async getTrace(@Query('id') id: string) {
    return this.tracing.getTraceById(id);
  }

  /**
   * Get all traces
   */
  @Get('traces')
  async getAllTraces() {
    return this.tracing.getAllSpans();
  }

  /**
   * Get trace statistics
   */
  @Get('traces/statistics')
  async getTraceStatistics() {
    return this.tracing.getTraceStatistics();
  }

  /**
   * Get metrics
   */
  @Get('metrics/:name')
  async getMetrics(
    @Query('name') name: string,
    @Query('limit') limit?: number,
  ) {
    return this.metrics.getMetrics(
      name,
      limit ? parseInt(limit.toString()) : undefined,
    );
  }

  /**
   * Get metric statistics
   */
  @Get('metrics/:name/statistics')
  async getMetricStatistics(
    @Query('name') name: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const timeRange =
      startTime && endTime
        ? { start: new Date(startTime), end: new Date(endTime) }
        : undefined;

    return this.metrics.getMetricStatistics(name, timeRange);
  }

  /**
   * Get all metrics
   */
  @Get('metrics')
  async getAllMetrics() {
    return {
      names: this.metrics.getMetricNames(),
      statistics: this.metrics.getAllMetricsStatistics(),
    };
  }

  /**
   * Get dashboard metrics
   */
  @Get('metrics/dashboard')
  async getDashboardMetrics() {
    return this.metrics.getDashboardMetrics();
  }

  /**
   * Export Prometheus metrics
   */
  @Get('metrics/export/prometheus')
  async exportPrometheusMetrics() {
    return this.metrics.exportPrometheusMetrics();
  }

  /**
   * Get anomalies
   */
  @Get('anomalies')
  async getAnomalies(@Query('limit') limit?: number) {
    return this.anomalyDetection.getAnomalies(
      limit ? parseInt(limit.toString()) : undefined,
    );
  }

  /**
   * Get anomalies by metric
   */
  @Get('anomalies/metric/:name')
  async getAnomaliesByMetric(@Query('name') name: string) {
    return this.anomalyDetection.getAnomaliesByMetric(name);
  }

  /**
   * Get recent anomalies
   */
  @Get('anomalies/recent')
  async getRecentAnomalies(@Query('minutes') minutes?: number) {
    return this.anomalyDetection.getRecentAnomalies(
      minutes ? parseInt(minutes.toString()) : 60,
    );
  }

  /**
   * Get anomaly statistics
   */
  @Get('anomalies/statistics')
  async getAnomalyStatistics() {
    return this.anomalyDetection.getAnomalyStatistics();
  }

  /**
   * Get system health
   */
  @Get('health')
  async getSystemHealth() {
    return this.anomalyDetection.getSystemHealth();
  }

  /**
   * Detect anomalies in a metric
   */
  @Post('anomalies/detect')
  async detectAnomalies(
    @Body() body: { metricName: string; windowSize?: number },
  ) {
    return this.anomalyDetection.detectAnomalies(
      body.metricName,
      body.windowSize,
    );
  }
}
