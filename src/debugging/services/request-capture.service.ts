import { Inject, Injectable, Optional } from '@nestjs/common';
import { IDebugRecord } from '../interfaces/debug.interfaces';

/**
 * Configuration for the in-memory capture buffer. Capacity is bounded so the
 * debugger never grows unbounded in a long-running dev process.
 */
export interface CaptureConfig {
  /** Maximum number of records retained in the ring buffer. */
  capacity: number;
  /** Bodies larger than this (stringified length) are truncated. */
  maxBodyBytes: number;
  /** Header names that are redacted before storage. */
  redactedHeaders: string[];
}

const DEFAULT_CONFIG: CaptureConfig = {
  capacity: 200,
  maxBodyBytes: 64 * 1024,
  redactedHeaders: ['authorization', 'cookie', 'set-cookie', 'x-api-key'],
};

export const DEBUG_CAPTURE_CONFIG = 'DEBUG_CAPTURE_CONFIG';

/**
 * Stores captured request/response exchanges in a bounded in-memory ring
 * buffer. This is the backing store for the inspection and replay endpoints.
 *
 * Intentionally process-local and ephemeral: it is a developer aid, not an
 * audit log, so nothing is persisted.
 */
@Injectable()
export class RequestCaptureService {
  private readonly config: CaptureConfig;
  private readonly buffer: IDebugRecord[] = [];

  constructor(@Optional() @Inject(DEBUG_CAPTURE_CONFIG) config?: Partial<CaptureConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Store a record, evicting the oldest entry when at capacity. */
  store(record: IDebugRecord): void {
    this.buffer.push(this.sanitise(record));
    while (this.buffer.length > this.config.capacity) {
      this.buffer.shift();
    }
  }

  /** Return records newest-first, optionally limited. */
  list(limit?: number): IDebugRecord[] {
    const newestFirst = [...this.buffer].reverse();
    return typeof limit === 'number' ? newestFirst.slice(0, limit) : newestFirst;
  }

  /** Retrieve a single record by id. */
  get(id: string): IDebugRecord | undefined {
    return this.buffer.find((r) => r.id === id);
  }

  /** Drop everything currently buffered. */
  clear(): void {
    this.buffer.length = 0;
  }

  get size(): number {
    return this.buffer.length;
  }

  /** Redact sensitive headers and truncate oversized bodies before storage. */
  private sanitise(record: IDebugRecord): IDebugRecord {
    const redactHeaders = (headers: Record<string, string>) => {
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(headers)) {
        out[key] = this.config.redactedHeaders.includes(key.toLowerCase()) ? '[REDACTED]' : value;
      }
      return out;
    };

    const truncateBody = (body: unknown): unknown => {
      if (body === undefined || body === null) return body;
      const serialised = typeof body === 'string' ? body : JSON.stringify(body);
      if (serialised.length <= this.config.maxBodyBytes) return body;
      return `[TRUNCATED ${serialised.length} bytes]`;
    };

    return {
      ...record,
      request: {
        ...record.request,
        headers: redactHeaders(record.request.headers),
        body: truncateBody(record.request.body),
      },
      response: record.response
        ? {
            ...record.response,
            headers: redactHeaders(record.response.headers),
            body: truncateBody(record.response.body),
          }
        : undefined,
    };
  }
}
