import { Injectable, Logger } from '@nestjs/common';
import { AlertingService } from './alerting/alerting.service';

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricDefinition {
  name: string;
  description: string;
  type: MetricType;
  unit?: string;
  /** Optional alert threshold – fires via AlertingService when breached */
  alertThreshold?: number;
}

export interface MetricSample {
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export interface MetricAggregation {
  name: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  latest: number;
  lastUpdated: number;
}

/**
 * Custom business metric collection system.
 * Supports metric definition, real-time collection, aggregation and alert integration.
 */
@Injectable()
export class CustomMetricsService {
  private readonly logger = new Logger(CustomMetricsService.name);

  /** Registered metric definitions keyed by name */
  private readonly definitions = new Map<string, MetricDefinition>();

  /** Raw samples per metric (capped at 1 000 per metric) */
  private readonly samples = new Map<string, MetricSample[]>();

  private readonly MAX_SAMPLES = 1_000;

  constructor(private readonly alertingService: AlertingService) {}

  // ── Definition ──────────────────────────────────────────────────────────────

  /**
   * Register a custom metric definition.
   * Safe to call multiple times with the same name (idempotent).
   */
  define(definition: MetricDefinition): void {
    if (!this.definitions.has(definition.name)) {
      this.definitions.set(definition.name, definition);
      this.samples.set(definition.name, []);
      this.logger.log(`Metric defined: ${definition.name} (${definition.type})`);
    }
  }

  getDefinitions(): MetricDefinition[] {
    return Array.from(this.definitions.values());
  }

  // ── Collection ───────────────────────────────────────────────────────────────

  /**
   * Record a value for a named metric.
   * Auto-defines the metric as a gauge if it has not been registered yet.
   */
  record(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.definitions.has(name)) {
      this.define({ name, description: name, type: 'gauge' });
    }

    const sample: MetricSample = { value, labels, timestamp: Date.now() };
    const bucket = this.samples.get(name)!;
    bucket.push(sample);

    // Keep the ring buffer bounded
    if (bucket.length > this.MAX_SAMPLES) {
      bucket.splice(0, bucket.length - this.MAX_SAMPLES);
    }

    // Alert integration – evaluate threshold if configured
    const def = this.definitions.get(name)!;
    if (def.alertThreshold !== undefined) {
      this.alertingService.evaluateMetricThreshold(name, value);
    }
  }

  /** Convenience: increment a counter by `by` (default 1). */
  increment(name: string, by = 1, labels?: Record<string, string>): void {
    const bucket = this.samples.get(name) ?? [];
    const last = bucket[bucket.length - 1]?.value ?? 0;
    this.record(name, last + by, labels);
  }

  // ── Aggregation ───────────────────────────────────────────────────────────────

  /** Compute aggregation stats for a metric over the last `windowMs` ms. */
  aggregate(name: string, windowMs = 60_000): MetricAggregation | null {
    const bucket = this.samples.get(name);
    if (!bucket || bucket.length === 0) return null;

    const since = Date.now() - windowMs;
    const window = bucket.filter((s) => s.timestamp >= since);
    const values = (window.length ? window : bucket).map((s) => s.value);

    const sum = values.reduce((a, b) => a + b, 0);
    return {
      name,
      count: values.length,
      sum,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      latest: values[values.length - 1],
      lastUpdated: bucket[bucket.length - 1].timestamp,
    };
  }

  /** Return aggregations for every registered metric. */
  aggregateAll(windowMs = 60_000): MetricAggregation[] {
    return Array.from(this.definitions.keys())
      .map((name) => this.aggregate(name, windowMs))
      .filter((a): a is MetricAggregation => a !== null);
  }

  /** Raw samples for a single metric (newest last). */
  getSamples(name: string): MetricSample[] {
    return this.samples.get(name) ?? [];
  }
}
