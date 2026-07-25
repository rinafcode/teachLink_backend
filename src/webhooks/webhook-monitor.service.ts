import { Injectable, Logger, Optional } from '@nestjs/common';
import { CustomMetricsService } from '../monitoring/custom-metrics.service';

/** Snapshot of webhook delivery counters. */
export interface WebhookDeliveryStats {
  attempts: number;
  succeeded: number;
  failed: number;
  retried: number;
  deadLettered: number;
  /** failed / attempts, in the range [0, 1]. */
  failureRate: number;
}

export const WEBHOOK_METRICS = {
  ATTEMPTS: 'webhook.delivery.attempts',
  SUCCEEDED: 'webhook.delivery.succeeded',
  FAILED: 'webhook.delivery.failed',
  RETRIED: 'webhook.delivery.retried',
  DEAD_LETTERED: 'webhook.delivery.dead_lettered',
  DURATION_MS: 'webhook.delivery.duration_ms',
} as const;

/**
 * Centralises monitoring for outbound webhook delivery. Maintains in-memory
 * counters (always available, e.g. for health endpoints and tests) and, when a
 * {@link CustomMetricsService} is wired in, forwards the same signals to the
 * platform metrics/alerting pipeline.
 */
@Injectable()
export class WebhookMonitorService {
  private readonly logger = new Logger(WebhookMonitorService.name);

  private attempts = 0;
  private succeeded = 0;
  private failed = 0;
  private retried = 0;
  private deadLettered = 0;

  constructor(@Optional() private readonly metrics?: CustomMetricsService) {
    // Register definitions up front so an alert can fire on the failure counter.
    this.metrics?.define({
      name: WEBHOOK_METRICS.DEAD_LETTERED,
      description: 'Webhooks that exhausted all retries and were dead-lettered',
      type: 'counter',
      alertThreshold: 1,
    });
  }

  recordAttempt(event: string, url: string): void {
    this.attempts += 1;
    this.metrics?.increment(WEBHOOK_METRICS.ATTEMPTS, 1, { event });
    this.logger.debug?.(`Webhook attempt: ${event} -> ${url}`);
  }

  recordSuccess(event: string, durationMs: number): void {
    this.succeeded += 1;
    this.metrics?.increment(WEBHOOK_METRICS.SUCCEEDED, 1, { event });
    this.metrics?.record(WEBHOOK_METRICS.DURATION_MS, durationMs, { event });
  }

  recordRetry(event: string, attempt: number, delayMs: number): void {
    this.retried += 1;
    this.metrics?.increment(WEBHOOK_METRICS.RETRIED, 1, { event });
    this.logger.warn(
      `Webhook delivery for "${event}" failed; scheduling retry #${attempt} in ${delayMs}ms`,
    );
  }

  recordFailure(event: string, error: string): void {
    this.failed += 1;
    this.metrics?.increment(WEBHOOK_METRICS.FAILED, 1, { event });
    this.logger.error(`Webhook delivery for "${event}" failed: ${error}`);
  }

  recordDeadLetter(event: string, url: string, attempts: number): void {
    this.deadLettered += 1;
    this.metrics?.increment(WEBHOOK_METRICS.DEAD_LETTERED, 1, { event });
    this.logger.error(`Webhook "${event}" -> ${url} dead-lettered after ${attempts} attempts`);
  }

  getStats(): WebhookDeliveryStats {
    return {
      attempts: this.attempts,
      succeeded: this.succeeded,
      failed: this.failed,
      retried: this.retried,
      deadLettered: this.deadLettered,
      failureRate: this.attempts === 0 ? 0 : this.failed / this.attempts,
    };
  }
}
