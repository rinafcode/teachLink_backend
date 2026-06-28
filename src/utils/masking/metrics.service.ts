import { Injectable } from '@nestjs/common';
import { Registry, collectDefaultMetrics, Gauge, Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  // KPI Gauges
  public readonly activeUsersGauge: Gauge<string>;
  public readonly userRetentionGauge: Gauge<string>;
  public readonly enrollmentConversionGauge: Gauge<string>;
  public readonly paymentSuccessRateGauge: Gauge<string>;
  public readonly revenuePerCourseGauge: Gauge<string>;

  // Counters
  public readonly paymentsTotalCounter: Counter<string>;

  // Histograms
  public readonly apiLatencyHistogram: Histogram<string>;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({
      app: 'teachlink-backend',
    });

    // Enable default node.js metrics
    collectDefaultMetrics({ register: this.registry });

    // --- Initialize Gauges ---
    this.activeUsersGauge = new Gauge({
      name: 'teachlink_active_users',
      help: 'Number of active users over a time period',
      labelNames: ['period'], // 'daily', 'weekly', 'monthly'
      registers: [this.registry],
    });

    this.userRetentionGauge = new Gauge({
      name: 'teachlink_user_retention_rate',
      help: 'Cohort-based user retention rate',
      labelNames: ['cohort_month', 'retained_month'],
      registers: [this.registry],
    });

    this.enrollmentConversionGauge = new Gauge({
      name: 'teachlink_enrollment_conversion_rate',
      help: 'Course enrollment conversion rate',
      labelNames: ['courseId'],
      registers: [this.registry],
    });

    this.paymentSuccessRateGauge = new Gauge({
      name: 'teachlink_payment_success_rate',
      help: 'Success rate of payment transactions',
      registers: [this.registry],
    });

    this.revenuePerCourseGauge = new Gauge({
      name: 'teachlink_revenue_per_course',
      help: 'Total revenue generated per course',
      labelNames: ['courseId', 'courseName'],
      registers: [this.registry],
    });

    // --- Initialize Counters ---
    this.paymentsTotalCounter = new Counter({
      name: 'teachlink_payments_total',
      help: 'Total number of payment attempts',
      labelNames: ['status'], // 'succeeded', 'failed'
      registers: [this.registry],
    });

    // --- Initialize Histograms ---
    this.apiLatencyHistogram = new Histogram({
      name: 'teachlink_api_latency_seconds',
      help: 'API request latency in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], // Buckets in seconds
      registers: [this.registry],
    });
  }

  /**
   * Get the Prometheus metrics registry.
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Get metrics as a string for the /metrics endpoint.
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
