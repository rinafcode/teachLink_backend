import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios from 'axios';
import { createHmac } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { calculateBackoffDelay, isRetryableError, shouldRetry } from './webhook-backoff.util';
import {
  DEFAULT_WEBHOOK_RETRY_CONFIG,
  loadWebhookRetryConfig,
  WEBHOOK_RETRY_CONFIG,
  WebhookRetryConfig,
} from './webhook-retry.config';
import { WebhookMonitorService } from './webhook-monitor.service';

/** A single outbound webhook to deliver. */
export interface WebhookTarget {
  url: string;
  event: string;
  payload: unknown;
  /** Extra headers to merge into the request. */
  headers?: Record<string, string>;
  /** Shared secret; when set, an HMAC-SHA256 signature header is added. */
  secret?: string;
  /** Per-target request timeout override (ms). */
  timeoutMs?: number;
}

export interface WebhookDeliveryResult {
  event: string;
  url: string;
  delivered: boolean;
  statusCode?: number;
  attempts: number;
  deadLettered?: boolean;
  error?: string;
  deliveredAt?: Date;
}

/** Emitted on the EventEmitter2 bus for downstream monitoring/audit. */
export const WEBHOOK_EVENTS = {
  DELIVERED: 'webhook.delivered',
  RETRY_SCHEDULED: 'webhook.retry_scheduled',
  DEAD_LETTER: 'webhook.dead_letter',
} as const;

/**
 * Thrown when a delivery attempt fails but is eligible for another retry. The
 * Bull worker re-throws this so the job is re-enqueued with backoff, forming the
 * retry queue. Carries the computed delay for the next attempt.
 */
export class WebhookRetryableError extends Error {
  constructor(
    message: string,
    readonly nextDelayMs: number,
    readonly attempt: number,
  ) {
    super(message);
    this.name = 'WebhookRetryableError';
  }
}

/**
 * Delivers outbound webhooks over HTTP with exponential-backoff retries, a
 * configurable max retry count, dead-letter handling, and failure monitoring.
 *
 * Transient failures (5xx, timeouts, network errors) raise
 * {@link WebhookRetryableError} so the Bull retry queue re-enqueues them with an
 * exponential delay. Permanent failures (4xx) and exhausted retries are
 * dead-lettered immediately and reported to {@link WebhookMonitorService}.
 */
@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  private readonly config: WebhookRetryConfig;

  constructor(
    private readonly http: HttpService,
    private readonly monitor: WebhookMonitorService,
    @Optional() private readonly events?: EventEmitter2,
    @Optional() @Inject(WEBHOOK_RETRY_CONFIG) config?: WebhookRetryConfig,
  ) {
    this.config = config ?? DEFAULT_WEBHOOK_RETRY_CONFIG;
  }

  /**
   * Build a self-contained instance (own axios-backed HttpService and monitor)
   * for contexts that construct workers manually rather than via Nest DI, such
   * as the worker orchestration pool.
   */
  static createDefault(): WebhookDeliveryService {
    return new WebhookDeliveryService(
      new HttpService(axios.create()),
      new WebhookMonitorService(),
      undefined,
      loadWebhookRetryConfig(),
    );
  }

  /**
   * Bull-compatible job options that mirror this service's retry policy, so the
   * queue retries the right number of times with matching exponential backoff.
   */
  buildJobOptions() {
    return {
      attempts: this.config.maxRetries,
      backoff: { type: 'exponential', delay: this.config.initialDelayMs },
      removeOnComplete: true,
      removeOnFail: false,
    };
  }

  /**
   * Process one delivery attempt for a webhook job.
   *
   * @param target       the webhook to deliver
   * @param attemptsMade number of attempts already completed (Bull's job.attemptsMade)
   */
  async processDelivery(target: WebhookTarget, attemptsMade = 0): Promise<WebhookDeliveryResult> {
    this.validateTarget(target);
    const attempt = attemptsMade + 1;
    this.monitor.recordAttempt(target.event, target.url);

    const startedAt = Date.now();
    try {
      const statusCode = await this.sendRequest(target, attempt);
      const durationMs = Date.now() - startedAt;
      this.monitor.recordSuccess(target.event, durationMs);

      const result: WebhookDeliveryResult = {
        event: target.event,
        url: target.url,
        delivered: true,
        statusCode,
        attempts: attempt,
        deliveredAt: new Date(),
      };
      this.events?.emit(WEBHOOK_EVENTS.DELIVERED, result);
      this.logger.log(`Webhook "${target.event}" delivered to ${target.url} (attempt ${attempt})`);
      return result;
    } catch (error) {
      return this.handleFailure(target, attempt, attemptsMade, error);
    }
  }

  private handleFailure(
    target: WebhookTarget,
    attempt: number,
    attemptsMade: number,
    error: unknown,
  ): WebhookDeliveryResult {
    const message = this.errorMessage(error);
    const retryable = isRetryableError(error);
    const canRetry = retryable && shouldRetry(attempt, this.config);

    this.monitor.recordFailure(target.event, message);

    if (canRetry) {
      const nextDelayMs = calculateBackoffDelay(attempt, this.config);
      this.monitor.recordRetry(target.event, attempt, nextDelayMs);
      this.events?.emit(WEBHOOK_EVENTS.RETRY_SCHEDULED, {
        event: target.event,
        url: target.url,
        attempt,
        nextDelayMs,
        error: message,
      });
      // Re-thrown by the worker so Bull re-enqueues with backoff.
      throw new WebhookRetryableError(message, nextDelayMs, attempt);
    }

    // Permanent failure or retries exhausted → dead-letter (no further retries).
    this.monitor.recordDeadLetter(target.event, target.url, attempt);
    const result: WebhookDeliveryResult = {
      event: target.event,
      url: target.url,
      delivered: false,
      attempts: attempt,
      deadLettered: true,
      error: message,
    };
    this.events?.emit(WEBHOOK_EVENTS.DEAD_LETTER, {
      ...result,
      reason: retryable ? 'max_retries_exhausted' : 'permanent_failure',
    });
    return result;
  }

  /** Perform a single signed HTTP POST. Returns the status code on 2xx. */
  private async sendRequest(target: WebhookTarget, attempt: number): Promise<number> {
    const body = {
      id: `evt_${Date.now()}_${attempt}`,
      event: target.event,
      timestamp: new Date().toISOString(),
      payload: target.payload,
      attempt,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'TeachLink-Webhooks/1.0',
      'X-Webhook-Event': target.event,
      'X-Webhook-Attempt': String(attempt),
      ...target.headers,
    };

    if (target.secret) {
      const serialized = JSON.stringify(body);
      headers['X-Webhook-Signature'] = `sha256=${this.sign(serialized, target.secret)}`;
    }

    const response = await firstValueFrom(
      this.http.post(target.url, body, {
        headers,
        timeout: target.timeoutMs ?? this.config.timeoutMs,
      }),
    );
    return response.status;
  }

  private sign(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private validateTarget(target: WebhookTarget): void {
    if (!target?.url || !target.event || target.payload === undefined) {
      throw new Error('Missing required webhook fields: url, event, payload');
    }
  }

  private errorMessage(error: unknown): string {
    if (error && typeof error === 'object') {
      const err = error as { response?: { status?: number }; message?: string };
      if (err.response?.status) return `HTTP ${err.response.status}`;
      if (err.message) return err.message;
    }
    return String(error);
  }
}
