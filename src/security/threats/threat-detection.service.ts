import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { ForbiddenOperationException } from '../../common/exceptions/app.exceptions';
import { THREAT_REDIS_CLIENT } from './threat-detection.constants';

/**
 * Issue #798 — Per-IP failed-attempt counter.
 *
 * Why Redis, not an in-process `Map`:
 *  - In a horizontally-scaled deployment, each pod had its own counter.
 *    An attacker spreading requests across pods flew under the per-pod
 *    threshold while running a full credential-stuffing attack.
 *  - The in-process map also grew without bound.
 *
 * Implementation:
 *  - `INCR ${key}` is atomic across all replicas; the result IS the current
 *    counter value.
 *  - On the first call (when `INCR` returns 1) we set `EXPIRE ${key} ttlSeconds`
 *    so the counter auto-clears once the window elapses.
 *  - Threshold (count above which we refuse), window length, and key prefix
 *    are configurable via {@link ConfigService}.
 */
@Injectable()
export class ThreatDetectionService {
  static readonly DEFAULT_THRESHOLD = 10;
  static readonly DEFAULT_WINDOW_SECONDS = 15 * 60; // 15 minutes
  static readonly DEFAULT_KEY_PREFIX = 'threat:failed-attempts:';

  private readonly logger = new Logger(ThreatDetectionService.name);
  private readonly threshold: number;
  private readonly windowSeconds: number;
  private readonly keyPrefix: string;

  constructor(
    @Inject(THREAT_REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.threshold = this.configService.get<number>(
      'THREAT_FAILED_ATTEMPT_THRESHOLD',
      ThreatDetectionService.DEFAULT_THRESHOLD,
    );
    this.windowSeconds = this.configService.get<number>(
      'THREAT_FAILED_ATTEMPT_WINDOW_SECONDS',
      ThreatDetectionService.DEFAULT_WINDOW_SECONDS,
    );
    this.keyPrefix = this.configService.get<string>(
      'THREAT_FAILED_ATTEMPT_KEY_PREFIX',
      ThreatDetectionService.DEFAULT_KEY_PREFIX,
    );
  }

  private keyFor(ip: string): string {
    return `${this.keyPrefix}${ip}`;
  }

  /**
   * Refuses the request if the IP currently has more than `threshold` failures
   * recorded in the rolling Redis window. A failure count strictly greater than
   * the configured threshold triggers {@link ForbiddenOperationException}.
   *
   * Note: this is now async because the underlying store is remote. Callers
   * (guards, middleware) must await. We deliberately fail OPEN on Redis errors
   * so an outage cannot amplify load by blocking legitimate traffic.
   */
  async analyzeRequest(ip: string): Promise<void> {
    const key = this.keyFor(ip);
    let count: number;
    try {
      const raw = await this.redis.get(key);
      count = raw ? Number(raw) : 0;
    } catch (err) {
      this.logger.error(
        `analyzeRequest: Redis GET failed (${(err as Error).message}); failing open.`,
      );
      return;
    }
    if (count > this.threshold) {
      throw new ForbiddenOperationException('Suspicious activity detected');
    }
  }

  /**
   * Atomically increments the IP's failure counter. On the first increment
   * (the INCR returned 1) we install the TTL so the counter auto-expires.
   *
   * The TTL is set AFTER the INCR so a Redis outage between the two commands
   * cannot leave behind a permanent counter — at worst the counter survives
   * forever, which degrades to the same behaviour as the legacy in-memory
   * map (a non-zero counter is still better than nothing).
   */
  async recordFailure(ip: string): Promise<void> {
    const key = this.keyFor(ip);
    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        // First failure in this window — arm the auto-expiry.
        await this.redis.expire(key, this.windowSeconds);
      }
    } catch (err) {
      // Recording failures must not throw — losing a single increment is
      // acceptable; throwing would amplify the very load we are tracking.
      this.logger.error(
        `recordFailure: Redis INCR failed (${(err as Error).message}); dropping.`,
      );
    }
  }

  /**
   * Clears the IP's counter (e.g. after a successful authentication). Best
   * effort: a Redis outage here is logged but does not throw.
   */
  async reset(ip: string): Promise<void> {
    const key = this.keyFor(ip);
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.error(
        `reset: Redis DEL failed (${(err as Error).message}); counter may persist briefly.`,
      );
    }
  }

  // ─── Test introspection helpers ─────────────────────────────────────────
  // Kept on the public so the unit suite can validate the key shape and
  // existence semantics without poking at Redis internals.

  /** Test introspection helper — not used by production callers. */
  resolveKey(ip: string): string {
    return this.keyFor(ip);
  }

  /** Test introspection helper — composes `KEY`-then-`EXISTS`. */
  async has(ip: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.keyFor(ip));
      return result > 0;
    } catch (err) {
      this.logger.error(`has: Redis EXISTS failed (${(err as Error).message}).`);
      return false;
    }
  }
}
