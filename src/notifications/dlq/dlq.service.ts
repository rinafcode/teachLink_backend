import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Counter, Registry } from 'prom-client';
import { Notification, NotificationStatus } from '../entities/notification.entity';
import { NotificationsQueueService } from '../notifications.queue';
import { CustomMetricsService } from '../../monitoring/custom-metrics.service';

/** Prometheus metric name — matches the spec name `notification_dlq_total`. */
export const NOTIFICATION_DLQ_METRIC = 'notification_dlq_total';

/**
 * Alert threshold: fire an alert once the DLQ depth (cumulative entries)
 * exceeds this value.  Tune per deployment via the threshold on CustomMetricsService.
 */
const DLQ_ALERT_THRESHOLD = 5;

/** Maximum delivery attempts before a notification is considered permanently failed. */
export const MAX_DELIVERY_ATTEMPTS = 5;

export interface DlqItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  failureReason: string | null;
  deliveryAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any> | null;
}

/**
 * DlqService
 *
 * Issue #830 — dead-letter queue handling for permanently failing notification
 * jobs.  The DLQ is modelled as a query over the existing `notifications` table
 * for rows in `FAILED` status.  No extra DB table is required.
 *
 * Responsibilities:
 *  - List all DLQ entries with full error context.
 *  - Reprocess individual entries by resetting their status to PENDING and
 *    re-publishing via NotificationsQueueService.
 *  - Increment `notification_dlq_total` (Prometheus Counter) each time a
 *    notification is permanently dead-lettered.
 *  - Expose a Gauge-threshold alert via CustomMetricsService so a Prometheus
 *    alert fires when DLQ depth exceeds the configured threshold.
 */
@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  /** prom-client Counter registered on the shared registry. */
  private readonly dlqCounter: Counter<string>;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly queueService: NotificationsQueueService,
    @Optional() private readonly customMetrics?: CustomMetricsService,
    @Optional() private readonly promRegistry?: Registry,
  ) {
    // Register the Prometheus counter on the provided registry (or default).
    this.dlqCounter = new Counter({
      name: NOTIFICATION_DLQ_METRIC,
      help: 'Total number of notification jobs permanently moved to the dead-letter queue',
      labelNames: ['type'],
      registers: this.promRegistry ? [this.promRegistry] : [],
    });

    // Register the alert definition in CustomMetricsService so an alert fires
    // when cumulative DLQ entries breach the threshold (Issue #830).
    this.customMetrics?.define({
      name: NOTIFICATION_DLQ_METRIC,
      description: 'Notification jobs that exhausted all retries and landed in the DLQ',
      type: 'counter',
      alertThreshold: DLQ_ALERT_THRESHOLD,
    });
  }

  /**
   * List all permanently-failed notifications (the DLQ).
   * Returns full error context so an admin can triage the issue.
   */
  async listDlq(limit = 50, offset = 0): Promise<{ items: DlqItem[]; total: number }> {
    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: { status: NotificationStatus.FAILED },
      order: { updatedAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    const items: DlqItem[] = notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      failureReason: n.failureReason,
      deliveryAttempts: n.deliveryAttempts,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      metadata: n.metadata,
    }));

    return { items, total };
  }

  /**
   * Reprocess a single DLQ entry.
   * Resets the notification to PENDING and re-publishes it via the queue.
   * Returns the updated notification.
   */
  async retryJob(notificationId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, status: NotificationStatus.FAILED },
    });

    if (!notification) {
      throw new NotFoundException(
        `DLQ item ${notificationId} not found or is not in FAILED status`,
      );
    }

    // Reset for reprocessing — clear the failure state and decrement attempts
    // so the exponential backoff restarts from a clean state.
    notification.status = NotificationStatus.PENDING;
    notification.deliveryAttempts = 0;
    notification.failureReason = null as any;
    const reset = await this.notificationRepository.save(notification);

    this.logger.log(`DLQ item ${notificationId} reset to PENDING for reprocessing`);

    // Re-publish to the queue.  Errors here propagate to the caller as 5xx.
    await this.queueService.publishToTopic(reset);

    this.logger.log(`DLQ item ${notificationId} re-queued successfully`);
    return reset;
  }

  /**
   * Record that a notification has been permanently dead-lettered.
   * Called by NotificationsQueueService after max retries are exhausted.
   *
   * Increments the Prometheus counter and the CustomMetrics gauge so alerting
   * fires when the DLQ depth breaches the threshold (Issue #830).
   */
  recordDlqEntry(notification: Notification): void {
    // prom-client counter — scraped by Prometheus at /metrics.
    this.dlqCounter.inc({ type: notification.type });

    // CustomMetricsService increment — triggers AlertingService threshold check.
    this.customMetrics?.increment(NOTIFICATION_DLQ_METRIC, 1, { type: notification.type });

    this.logger.warn(
      `Notification ${notification.id} (type=${notification.type}) permanently dead-lettered ` +
        `after ${notification.deliveryAttempts} attempts`,
    );
  }
}
