import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CacheWarmingService } from './cache-warming.service';
import { CachingService } from './caching.service';

/**
 * Schedules background cache warming for high-traffic query patterns.
 */
@Injectable()
export class CacheWarmingScheduler implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingScheduler.name);

  constructor(
    private readonly warming: CacheWarmingService,
    private readonly caching: CachingService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Running initial cache warm-up on startup');
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
      this.logger.error(`Cache warm-up [${label}] failed`, error instanceof Error ? error.stack : error);
    }
  }
}
