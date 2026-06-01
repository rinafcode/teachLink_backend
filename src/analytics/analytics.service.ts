import { Injectable, Logger } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  private readonly featureEvents: Counter<'category' | 'action' | 'label'> | null;
  private readonly assessmentDuration: Histogram<'status'> | null;

  constructor(private readonly metrics: MetricsCollectionService) {
    const registry = this.metrics.getRegistry();

    this.featureEvents = this.registerMetric(() =>
      (registry.getSingleMetric('feature_events_total') as Counter<'category' | 'action' | 'label'>) ??
      new Counter({
        name: 'feature_events_total',
        help: 'Feature analytics events',
        labelNames: ['category', 'action', 'label'] as const,
        registers: [registry],
      }),
    );

    this.assessmentDuration = this.registerMetric(() =>
      (registry.getSingleMetric('assessment_duration_seconds') as Histogram<'status'>) ??
      new Histogram({
        name: 'assessment_duration_seconds',
        help: 'Time from attempt start to submission or timeout, in seconds',
        labelNames: ['status'] as const,
        buckets: [30, 60, 120, 300, 600, 1200, 1800],
        registers: [registry],
      }),
    );
  }

  // ── Generic event recording ────────────────────────────────────────────────

  recordEvent(category: string, action: string, label = '', value = 1): void {
    try {
      this.featureEvents?.inc({ category, action, label }, value);
    } catch (err) {
      this.logger.error(
        `Failed to record analytics event: ${category}.${action}`,
        err as Error,
      );
    }
  }

  // ── Assessment-domain events ───────────────────────────────────────────────

  recordAssessmentStarted(assessmentId: string): void {
    this.recordEvent('assessment', 'started', assessmentId);
  }

  recordAssessmentSubmitted(assessmentId: string, startedAt: Date): void {
    this.recordEvent('assessment', 'submitted', assessmentId);
    this.observeDuration(startedAt, 'submitted');
  }

  recordAssessmentTimedOut(assessmentId: string, startedAt: Date): void {
    this.recordEvent('assessment', 'timed_out', assessmentId);
    this.observeDuration(startedAt, 'timed_out');
  }

  recordAssessmentScore(score: number, maxScore: number): void {
    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    this.recordEvent('assessment', 'score_recorded', '', pct);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private observeDuration(startedAt: Date, status: string): void {
    try {
      const seconds = (Date.now() - startedAt.getTime()) / 1000;
      this.assessmentDuration?.observe({ status }, seconds);
    } catch (err) {
      this.logger.error('Failed to observe assessment duration', err as Error);
    }
  }

  /**
   * Wraps metric construction in a try/catch so a misconfigured registry
   * (e.g. duplicate registration in tests) degrades to a null metric rather
   * than crashing the service on startup.
   */
  private registerMetric<T>(factory: () => T): T | null {
    try {
      return factory();
    } catch (err) {
      this.logger.warn('Could not register metric; proceeding without it', err as Error);
      return null;
    }
  }
}