import { Injectable, Logger } from '@nestjs/common';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private featureEventsCounter: any | null = null;

  constructor(private readonly metrics: MetricsCollectionService) {
    try {
      const registry = this.metrics.getRegistry();
      // Lazy require prom-client to avoid import cycles
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const prom = require('prom-client');

      // Create a shared counter for feature events with labels
      this.featureEventsCounter =
        registry.getSingleMetric('feature_events_total') ||
        new prom.Counter({
          name: 'feature_events_total',
          help: 'Feature analytics events',
          labelNames: ['category', 'action'],
          registers: [registry],
        });
    } catch (err) {
      this.logger.warn('Could not initialize feature events counter', err as Error);
      this.featureEventsCounter = null;
    }
  }

  recordEvent(category: string, action: string, label?: string, value?: number): void {
    try {
      if (this.featureEventsCounter) {
        this.featureEventsCounter.inc({ category, action }, value ?? 1);
      } else {
        this.logger.debug(`Analytics event (log only): ${category}.${action} value=${value}`);
      }
    } catch (err) {
      this.logger.error('Failed to record analytics event', err as Error);
    }
  }
}
