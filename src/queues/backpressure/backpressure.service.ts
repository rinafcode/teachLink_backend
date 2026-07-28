import { Injectable, Logger } from '@nestjs/common';
import { QUEUE_HEALTH_THRESHOLDS } from '../queues.constants';

export type BackpressureLevel = 'normal' | 'warning' | 'critical';

export interface QueueDepthSnapshot {
  queueName: string;
  depth: number;
  active: number;
  level: BackpressureLevel;
  rateLimitActive: boolean;
  checkedAt: string;
}

export interface BackpressureState {
  level: BackpressureLevel;
  depth: number;
  active: number;
  rateLimitActive: boolean;
  /** Delay in ms to apply before accepting the next job (0 = no delay). */
  delayMs: number;
}

/**
 * BackpressureService
 *
 * Tracks queue depth and active job counts, applies rate-limiting when
 * thresholds are breached, and exposes monitoring snapshots.
 *
 * Usage:
 *   - Call `evaluate(queueName, depth, active)` before enqueuing a job.
 *   - If `state.rateLimitActive` is true, delay by `state.delayMs` ms or
 *     reject the job with a 429 response.
 *   - Call `getSnapshot(queueName)` from a health/metrics endpoint.
 */
@Injectable()
export class BackpressureService {
  private readonly logger = new Logger(BackpressureService.name);

  /** Per-queue state map. */
  private readonly states = new Map<string, BackpressureState>();
  /** Per-queue depth history for alerting deduplication. */
  private readonly alertedCritical = new Set<string>();

  evaluate(queueName: string, depth: number, active: number): BackpressureState {
    const level = this.resolveLevel(depth, active);
    const rateLimitActive = level !== 'normal';
    const delayMs = level === 'critical' ? 5_000 : level === 'warning' ? 1_000 : 0;

    const state: BackpressureState = { level, depth, active, rateLimitActive, delayMs };
    this.states.set(queueName, state);

    if (level === 'critical' && !this.alertedCritical.has(queueName)) {
      this.alertedCritical.add(queueName);
      this.logger.error(
        `[BACKPRESSURE] Queue "${queueName}" is CRITICAL — depth: ${depth}, active: ${active}. Rate limiting enabled (delay: ${delayMs}ms).`,
      );
    } else if (level === 'warning') {
      this.logger.warn(
        `[BACKPRESSURE] Queue "${queueName}" is at WARNING level — depth: ${depth}, active: ${active}.`,
      );
    } else if (level === 'normal' && this.alertedCritical.has(queueName)) {
      this.alertedCritical.delete(queueName);
      this.logger.log(`[BACKPRESSURE] Queue "${queueName}" recovered to normal.`);
    }

    return state;
  }

  getState(queueName: string): BackpressureState | null {
    return this.states.get(queueName) ?? null;
  }

  getSnapshot(queueName: string): QueueDepthSnapshot | null {
    const state = this.states.get(queueName);
    if (!state) return null;
    return {
      queueName,
      depth: state.depth,
      active: state.active,
      level: state.level,
      rateLimitActive: state.rateLimitActive,
      checkedAt: new Date().toISOString(),
    };
  }

  getAllSnapshots(): QueueDepthSnapshot[] {
    return Array.from(this.states.entries()).map(([queueName, state]) => ({
      queueName,
      depth: state.depth,
      active: state.active,
      level: state.level,
      rateLimitActive: state.rateLimitActive,
      checkedAt: new Date().toISOString(),
    }));
  }

  private resolveLevel(depth: number, active: number): BackpressureLevel {
    if (
      depth >= QUEUE_HEALTH_THRESHOLDS.BACKLOG_CRITICAL ||
      active >= QUEUE_HEALTH_THRESHOLDS.ACTIVE_JOBS_CRITICAL
    ) {
      return 'critical';
    }
    if (
      depth >= QUEUE_HEALTH_THRESHOLDS.BACKLOG_WARNING ||
      active >= QUEUE_HEALTH_THRESHOLDS.ACTIVE_JOBS_WARNING
    ) {
      return 'warning';
    }
    return 'normal';
  }
}
