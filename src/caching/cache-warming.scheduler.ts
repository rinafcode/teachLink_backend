import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CacheWarmingService } from './cache-warming.service';
import { CachingService } from './caching.service';
import { CACHE_WARMING } from './caching.constants';

/**
 * Schedules background cache warming for high-traffic query patterns.
 *
 * ### Startup behaviour
 * Implements `OnApplicationBootstrap` instead of `OnModuleInit` so the
 * initial warm-up only begins *after* the HTTP server is accepting traffic.
 * An additional `CACHE_WARMING.STARTUP_DELAY_MS` pause (default 5 s, tunable
 * via `CACHE_WARM_STARTUP_DELAY_MS`) further delays the first pass, giving
 * the application time to finish any post-boot work before we fire expensive
 * DB queries.
 *
 * ### Scheduled cadence (aligned with cache TTLs)
 * | Target           | Cron            | TTL     |
 * |------------------|-----------------|---------|
 * | Search results   | every 2 min     | 2 min   |
 * | User profiles    | every 10 min    | 10 min  |
 * | Course listings  | every 15 min    | 15 min  |
 * | Popular courses  | every 30 min    | 30 min  |
 */
@Injectable()
export class CacheWarmingScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(CacheWarmingScheduler.name);

  constructor(
    private readonly warming: CacheWarmingService,
    private readonly caching: CachingService,
  ) {}

  /**
   * Deferred startup warm-up.
   *
   * Fires after the application is fully bootstrapped (HTTP server is live).
   * Waits `CACHE_WARMING.STARTUP_DELAY_MS` milliseconds before running the
   * full warm-up so that expensive DB queries do not compete with the last
   * steps of the boot sequence.
   */
  async onApplicationBootstrap(): Promise<void> {
    this.logger.log(
      `Startup cache warm-up deferred by ${CACHE_WARMING.STARTUP_DELAY_MS}ms`,
    );
    await this.delay(CACHE_WARMING.STARTUP_DELAY_MS);
    this.logger.log('Running deferred startup cache warm-up');
    await this.runWarmUp('startup');
  }

  /** Search results — TTL 2 min */
  @Cron('0 */2 * * * *')
  async warmSearchResults(): Promise<void> {
    await this.runWarmUp('SEARCH_RESULTS', () => this.warming.warmSearchResults());
  }

  /** User profiles — TTL 10 min */
  @Cron('0 */10 * * * *')
  async warmUserProfiles(): Promise<void> {
    await this.runWarmUp('USER_PROFILE', () => this.warming.warmUserProfiles());
  }

  /** Course listings — TTL 15 min */
  @Cron('0 */15 * * * *')
  async warmCoursesList(): Promise<void> {
    await this.runWarmUp('COURSES_LIST', () => this.warming.warmCoursesList());
  }

  /** Popular courses — TTL 30 min */
  @Cron('0 */30 * * * *')
  async warmPopularCourses(): Promise<void> {
    await this.runWarmUp('POPULAR_COURSES', () => this.warming.warmPopularCourses());
  }

  /** Publish hit-rate metrics every 5 minutes */
  @Cron('0 */5 * * * *')
  publishCacheMetrics(): void {
    this.caching.publishHitRateMetrics('application');
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async runWarmUp(
    label: string,
    task?: () => Promise<{ target: string; keysWarmed: number; durationMs: number }>,
  ): Promise<void> {
    try {
      const results = task ? [await task()] : await this.warming.warmAll();
      for (const result of results) {
        this.logger.log(
          `Cache warm-up [${label}/${result.target}] warmed ${result.keysWarmed} key(s) in ${result.durationMs}ms`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Cache warm-up [${label}] failed`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
