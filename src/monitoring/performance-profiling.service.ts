import { Injectable, Logger } from '@nestjs/common';

export interface ProfileSample {
  label: string;
  durationMs: number;
  memoryDeltaBytes?: number;
}

@Injectable()
export class PerformanceProfilingService {
  private readonly logger = new Logger(PerformanceProfilingService.name);
  private readonly samples: ProfileSample[] = [];

  /**
   * Profiles an async operation and records CPU time and memory delta.
   * @param label  Human-readable name for the operation.
   * @param fn     The async function to profile.
   */
  async profile<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const memBefore = process.memoryUsage().heapUsed;
    const start = performance.now();

    const result = await fn();

    const durationMs = parseFloat((performance.now() - start).toFixed(3));
    const memoryDeltaBytes = process.memoryUsage().heapUsed - memBefore;

    const sample: ProfileSample = { label, durationMs, memoryDeltaBytes };
    this.samples.push(sample);
    this.logger.debug(`[profile] ${label}: ${durationMs}ms, mem Δ${memoryDeltaBytes}B`);

    return result;
  }

  /** Returns all recorded samples. */
  getReport(): ProfileSample[] {
    return [...this.samples];
  }

  /** Clears all recorded samples. */
  clearReport(): void {
    this.samples.length = 0;
  }
}