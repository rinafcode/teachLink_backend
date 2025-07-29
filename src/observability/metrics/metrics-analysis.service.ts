import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { MetricEntry, MetricType } from '../entities/metric-entry.entity';
import { ObservabilityConfig } from '../observability.service';
import { register, Counter, Gauge, Histogram, Summary, Registry } from 'prom-client';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

interface BusinessMetrics {
  userRegistrations: Counter<string>;
  courseEnrollments: Counter<string>;
  assessmentCompletions: Counter<string>;
  paymentTransactions: Counter<string>;
  activeUsers: Gauge<string>;
  systemLoad: Gauge<string>;
  requestDuration: Histogram<string>;
  errorRate: Counter<string>;
}

@Injectable()
export class MetricsAnalysisService {
  private readonly logger = new Logger(MetricsAnalysisService.name);
  private config: ObservabilityConfig;
  private registry: Registry;
  private businessMetrics: BusinessMetrics;

  constructor(
    @InjectRepository(MetricEntry)
    private readonly metricEntryRepository: Repository<MetricEntry>,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly configService: ConfigService,
  ) {
    this.registry = register;
    this.initializeBusinessMetrics();
  }

  async initialize(config: ObservabilityConfig): Promise<void> {
    this.config = config;
    await this.createElasticsearchIndex();
    this.logger.log('Metrics analysis service initialized');
  }

  private initializeBusinessMetrics(): void {
    this.businessMetrics = {
      userRegistrations: new Counter({
        name: 'teachlink_user_registrations_total',
        help: 'Total number of user registrations',
        labelNames: ['method', 'status'],
        registers: [this.registry],
      }),

      courseEnrollments: new Counter({
        name: 'teachlink_course_enrollments_total',
        help: 'Total number of course enrollments',
        labelNames: ['course_id', 'user_type'],
        registers: [this.registry],
      }),

      assessmentCompletions: new Counter({
        name: 'teachlink_assessment_completions_total',
        help: 'Total number of assessment completions',
        labelNames: ['assessment_id', 'score_range'],
        registers: [this.registry],
      }),

      paymentTransactions: new Counter({
        name: 'teachlink_payment_transactions_total',
        help: 'Total number of payment transactions',
        labelNames: ['payment_method', 'status', 'amount_range'],
        registers: [this.registry],
      }),

      activeUsers: new Gauge({
        name: 'teachlink_active_users',
        help: 'Number of currently active users',
        labelNames: ['time_period'],
        registers: [this.registry],
      }),

      systemLoad: new Gauge({
        name: 'teachlink_system_load',
        help: 'Current system load average',
        registers: [this.registry],
      }),

      requestDuration: new Histogram({
        name: 'teachlink_request_duration_seconds',
        help: 'HTTP request duration in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
        registers: [this.registry],
      }),

      errorRate: new Counter({
        name: 'teachlink_errors_total',
        help: 'Total number of errors',
        labelNames: ['error_type', 'service', 'severity'],
        registers: [this.registry],
      }),
    };
  }

  private async createElasticsearchIndex(): Promise<void> {
    try {
      const indexExists = await this.elasticsearchService.indices.exists({
        index: 'metric_entries',
      });

      if (!indexExists) {
        await this.elasticsearchService.indices.create({
          index: 'metric_entries',
          body: {
            mappings: {
              properties: {
                timestamp: { type: 'date' },
                metricName: { type: 'keyword' },
                metricType: { type: 'keyword' },
                value: { type: 'double' },
                serviceName: { type: 'keyword' },
                tags: { type: 'object' },
                labels: { type: 'object' },
                correlationId: { type: 'keyword' },
                traceId: { type: 'keyword' },
                userId: { type: 'keyword' },
              },
            },
          },
        });
        this.logger.log('Elasticsearch index created for metrics');
      }
    } catch (error) {
      this.logger.error('Error creating Elasticsearch index:', error);
    }
  }

  /**
   * Record a custom metric
   */
  async recordMetric(
    name: string,
    value: number,
    type: MetricType,
    tags?: Record<string, any>,
    correlationId?: string,
  ): Promise<void> {
    // Save to database
    const metricEntry = new MetricEntry();
    metricEntry.timestamp = new Date();
    metricEntry.metricName = name;
    metricEntry.metricType = type;
    metricEntry.value = value;
    metricEntry.serviceName = this.config.serviceName;
    metricEntry.tags = tags;
    metricEntry.correlationId = correlationId;

    await this.metricEntryRepository.save(metricEntry);

    // Index in Elasticsearch
    await this.elasticsearchService.index({
      index: 'metric_entries',
      body: metricEntry,
    });

    this.logger.debug(`Metric recorded: ${name} = ${value}`);
  }

  /**
   * Record business metrics
   */
  async recordUserRegistration(method: string, status: string): Promise<void> {
    this.businessMetrics.userRegistrations.inc({ method, status });
    await this.recordMetric('user_registrations', 1, MetricType.COUNTER, { method, status });
  }

  async recordCourseEnrollment(courseId: string, userType: string): Promise<void> {
    this.businessMetrics.courseEnrollments.inc({ course_id: courseId, user_type: userType });
    await this.recordMetric('course_enrollments', 1, MetricType.COUNTER, { courseId, userType });
  }

  async recordAssessmentCompletion(assessmentId: string, score: number): Promise<void> {
    const scoreRange = this.getScoreRange(score);
    this.businessMetrics.assessmentCompletions.inc({ assessment_id: assessmentId, score_range: scoreRange });
    await this.recordMetric('assessment_completions', 1, MetricType.COUNTER, { assessmentId, score, scoreRange });
  }

  async recordPaymentTransaction(method: string, status: string, amount: number): Promise<void> {
    const amountRange = this.getAmountRange(amount);
    this.businessMetrics.paymentTransactions.inc({ payment_method: method, status, amount_range: amountRange });
    await this.recordMetric('payment_transactions', amount, MetricType.COUNTER, { method, status, amountRange });
  }

  async updateActiveUsers(count: number, timePeriod: string = 'current'): Promise<void> {
    this.businessMetrics.activeUsers.set({ time_period: timePeriod }, count);
    await this.recordMetric('active_users', count, MetricType.GAUGE, { timePeriod });
  }

  async recordRequestDuration(method: string, route: string, statusCode: number, duration: number): Promise<void> {
    this.businessMetrics.requestDuration.observe(
      { method, route, status_code: statusCode.toString() },
      duration / 1000 // Convert to seconds
    );
    await this.recordMetric('request_duration', duration, MetricType.HISTOGRAM, { method, route, statusCode });
  }

  async recordError(errorType: string, service: string, severity: string): Promise<void> {
    this.businessMetrics.errorRate.inc({ error_type: errorType, service, severity });
    await this.recordMetric('errors', 1, MetricType.COUNTER, { errorType, service, severity });
  }

  /**
   * Get metric analytics
   */
  async getMetricAnalytics(
    metricName: string,
    startTime: Date,
    endTime: Date,
  ): Promise<{
    total: number;
    average: number;
    min: number;
    max: number;
    count: number;
    percentiles: Record<string, number>;
  }> {
    const metrics = await this.metricEntryRepository.find({
      where: {
        metricName,
        timestamp: Between(startTime, endTime),
      },
      order: { timestamp: 'ASC' },
    });

    if (metrics.length === 0) {
      return {
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        count: 0,
        percentiles: {},
      };
    }

    const values = metrics.map(m => Number(m.value));
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate percentiles
    const sortedValues = [...values].sort((a, b) => a - b);
    const percentiles = {
      p50: this.calculatePercentile(sortedValues, 50),
      p90: this.calculatePercentile(sortedValues, 90),
      p95: this.calculatePercentile(sortedValues, 95),
      p99: this.calculatePercentile(sortedValues, 99),
    };

    return {
      total,
      average,
      min,
      max,
      count: metrics.length,
      percentiles,
    };
  }

  /**
   * Automatically collect system metrics
   */
  @Cron('*/30 * * * * *') // Every 30 seconds
  async collectSystemMetrics(): Promise<void> {
    try {
      // System load
      const loadAvg = require('os').loadavg()[0];
      this.businessMetrics.systemLoad.set(loadAvg);
      await this.recordMetric('system_load', loadAvg, MetricType.GAUGE);

      // Memory usage
      const memUsage = process.memoryUsage();
      await this.recordMetric('memory_heap_used', memUsage.heapUsed, MetricType.GAUGE);
      await this.recordMetric('memory_heap_total', memUsage.heapTotal, MetricType.GAUGE);
      await this.recordMetric('memory_rss', memUsage.rss, MetricType.GAUGE);

      // CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      await this.recordMetric('cpu_user_time', cpuUsage.user, MetricType.GAUGE);
      await this.recordMetric('cpu_system_time', cpuUsage.system, MetricType.GAUGE);

      this.logger.debug('System metrics collected');
    } catch (error) {
      this.logger.error('Error collecting system metrics:', error);
    }
  }

  private getScoreRange(score: number): string {
    if (score >= 90) return '90-100';
    if (score >= 80) return '80-89';
    if (score >= 70) return '70-79';
    if (score >= 60) return '60-69';
    return '0-59';
  }

  private getAmountRange(amount: number): string {
    if (amount >= 1000) return '1000+';
    if (amount >= 500) return '500-999';
    if (amount >= 100) return '100-499';
    if (amount >= 50) return '50-99';
    return '0-49';
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1];
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  async getMetricCount(from: Date, to: Date): Promise<number> {
    return this.metricEntryRepository.count({
      where: {
        timestamp: Between(from, to),
      },
    });
  }

  async searchMetrics(query: {
    text?: string;
    correlationId?: string;
    startTime?: Date;
    endTime?: Date;
    services?: string[];
  }): Promise<any[]> {
    const searchResults = await this.elasticsearchService.search({
      index: 'metric_entries',
      body: {
        query: {
          bool: {
            must: [
              query.text ? { match: { metricName: query.text } } : {},
              query.correlationId ? { match: { correlationId: query.correlationId } } : {},
              query.startTime && query.endTime
                ? { range: { timestamp: { gte: query.startTime, lte: query.endTime } } }
                : {},
              query.services ? { terms: { serviceName: query.services } } : {},
            ],
          },
        },
      },
    });
    return searchResults.hits.hits;
  }

  async getHealthStatus(): Promise<{ status: string }> {
    return { status: 'healthy' };
  }
}
