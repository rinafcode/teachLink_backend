import { Injectable, Logger, Optional } from '@nestjs/common';
import { LRUCache } from 'lru-cache';
import { ForbiddenOperationException } from '../../common/exceptions/app.exceptions';

/**
 * Provides threat Detection operations.
 *
 * Tracks per-IP failed attempt counts in a bounded LRU cache so that
 * IP-rotation attacks or large user bases cannot cause the heap to grow
 * unbounded (see issue #882).
 *
 * The cache is capped at `MAX_ENTRIES` entries and each entry expires
 * `TTL_MS` after it was last written. Eviction of an entry (whether due
 * to the cap or TTL expiry) emits a single warning log so operators can
 * detect sustained pressure on the structure.
 */
@Injectable()
export class ThreatDetectionService {
  /** Max number of tracked IPs. Tuned for memory-bounded operation. */
  static readonly MAX_ENTRIES = 50_000;
  /** 15-minute TTL on each entry. */
  static readonly TTL_MS = 15 * 60 * 1000;

  private readonly logger = new Logger(ThreatDetectionService.name);
  private readonly failedAttempts: LRUCache<string, number>;
  private lastEvictionWarnAt = 0;

  constructor(@Optional() options?: { max?: number; ttlMs?: number }) {
    const max = options?.max ?? ThreatDetectionService.MAX_ENTRIES;
    const ttl = options?.ttlMs ?? ThreatDetectionService.TTL_MS;

    // `lru-cache` v11 fires the `dispose` callback once per eviction. We
    // rate-limit the warn log to once per 60 s so a flood of evictions does
    // not amplify the very load we are trying to detect.
    this.failedAttempts = new LRUCache<string, number>({
      max,
      ttl,
      ttlAutopurge: true,
      updateAgeOnGet: false,
      dispose: (_value, _key, reason) => {
        if (reason !== 'evict') return;
        const now = Date.now();
        if (now - this.lastEvictionWarnAt < 60_000) return;
        this.lastEvictionWarnAt = now;
        this.logger.warn(
          `LRU eviction triggered on failedAttempts cache (cap=${max}). ` +
            'Sustained pressure indicates a potential IP-rotation attack; ' +
            'consider raising MAX_ENTRIES or migrating to a distributed store.',
        );
      },
    });
  }

  analyzeRequest(ip: string): void {
    const attempts = this.failedAttempts.get(ip) || 0;
    if (attempts > 10) {
      throw new ForbiddenOperationException('Suspicious activity detected');
    }
  }

  recordFailure(ip: string): void {
    const attempts = this.failedAttempts.get(ip) || 0;
    this.failedAttempts.set(ip, attempts + 1);
  }

  reset(ip: string): void {
    this.failedAttempts.delete(ip);
  }

  /** Test introspection helper — not used by production callers. */
  getCacheSize(): number {
    return this.failedAttempts.size;
  }

  /** Test introspection helper — checks for presence in the bounded cache. */
  has(ip: string): boolean {
    return this.failedAttempts.has(ip);
  }
}
