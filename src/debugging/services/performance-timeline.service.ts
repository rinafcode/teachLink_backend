import { Injectable } from '@nestjs/common';
import {
  IPerformanceTimeline,
  ITimelineSpan,
} from '../interfaces/debug.interfaces';

/**
 * A mutable timeline builder scoped to a single request. The middleware creates
 * one of these per request and hands it down so any layer can record spans.
 */
export class TimelineRecorder {
  private readonly spans: ITimelineSpan[] = [];
  private readonly startedAt = process.hrtime.bigint();

  constructor(public readonly requestId: string) {}

  /** Record a span given an absolute high-resolution start marker. */
  record(name: string, startMark: bigint, metadata?: Record<string, unknown>): void {
    const now = process.hrtime.bigint();
    this.spans.push({
      name,
      startOffsetMs: this.toMs(startMark - this.startedAt),
      durationMs: this.toMs(now - startMark),
      metadata,
    });
  }

  /**
   * Time an arbitrary (optionally async) operation and record it as a span.
   * Returns the operation's result so it can be used transparently.
   */
  async measure<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
    const start = process.hrtime.bigint();
    try {
      return await fn();
    } finally {
      this.record(name, start);
    }
  }

  /** Marker helper so callers don't need to import process.hrtime directly. */
  mark(): bigint {
    return process.hrtime.bigint();
  }

  /** Finalise into an immutable timeline snapshot. */
  build(): IPerformanceTimeline {
    const total = this.toMs(process.hrtime.bigint() - this.startedAt);
    return {
      requestId: this.requestId,
      totalDurationMs: total,
      // Sort by start offset so the timeline reads chronologically.
      spans: [...this.spans].sort((a, b) => a.startOffsetMs - b.startOffsetMs),
    };
  }

  private toMs(nanos: bigint): number {
    return Math.round(Number(nanos) / 1e3) / 1e3; // nanoseconds → ms, 3dp
  }
}

/**
 * Factory + helper service for performance timelines. Kept as an injectable so
 * it can be mocked in controllers/tests and so future config (e.g. sampling)
 * has a home.
 */
@Injectable()
export class PerformanceTimelineService {
  create(requestId: string): TimelineRecorder {
    return new TimelineRecorder(requestId);
  }

  /**
   * Identify spans that dominate the request, useful for surfacing the slowest
   * phase in the inspector UI. Returns spans sorted by duration descending.
   */
  hotspots(timeline: IPerformanceTimeline, limit = 3): ITimelineSpan[] {
    return [...timeline.spans]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, limit);
  }
}
