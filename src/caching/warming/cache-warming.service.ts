import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CachingService } from '../caching.service';
import { CacheStrategiesService } from '../strategies/cache-strategies.service';
import { CACHE_TTL, CACHE_PREFIXES } from '../caching.constants';

export interface ICacheWarmingConfig {
  /**
   * Whether cache warming is enabled
   */
  enabled: boolean;

  /**
   * Warm popular courses on startup
   */
  warmPopularCourses: boolean;

  /**
   * Warm featured content on startup
   */
  warmFeaturedContent: boolean;

  /**
   * Number of popular courses to warm
   */
  popularCoursesLimit: number;

  /**
   * Warm system configuration
   */
  warmSystemConfig: boolean;

  /**
   * Delay before starting cache warming (ms)
   */
  startupDelay: number;
}

export interface IWarmedData {
  key: string;
  type: string;
  timestamp: Date;
}

/**
 * Interface for data providers that can be warmed
 */
export interface ICacheWarmableProvider {
  /**
   * Get data to warm into cache
   */
  getWarmableData(): Promise<Array<{ key: string; data: any; ttl?: number }>>;
}

@Injectable()
export class CacheWarmingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheWarmingService.name);
  private readonly config: ICacheWarmingConfig;
  private warmedKeys: Map<string, IWarmedData> = new Map();
  private warmupInterval?: NodeJS.Timeout;
  private dataProviders: ICacheWarmableProvider[] = [];

  constructor(
    private readonly cachingService: CachingService,
    private readonly strategiesService: CacheStrategiesService,
    private readonly configService: ConfigService,
    @Optional() @Inject('CACHE_WARMING_CONFIG') config?: Partial<ICacheWarmingConfig>,
  ) {
    this.config = {
      enabled: this.configService.get<string>('CACHE_WARMING_ENABLED') !== 'false',
      warmPopularCourses: true,
      warmFeaturedContent: true,
      popularCoursesLimit: parseInt(
        this.configService.get<string>('CACHE_WARMING_POPULAR_LIMIT') || '10',
        10,
      ),
      warmSystemConfig: true,
      startupDelay: parseInt(this.configService.get<string>('CACHE_WARMING_DELAY') || '5000', 10),
      ...config,
    };
  }

  /**
   * Register a data provider for cache warming
   */
  registerDataProvider(provider: ICacheWarmableProvider): void {
    this.dataProviders.push(provider);
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log('Cache warming is disabled');
      return;
    }

    // Delay warming to allow the application to fully start
    setTimeout(() => {
      this.warmCache().catch((error) => {
        this.logger.error('Failed to warm cache on startup', error);
      });
    }, this.config.startupDelay);

    // Schedule periodic refresh of warmed data
    this.schedulePeriodicWarmup();
  }

  onModuleDestroy(): void {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
    }
    this.warmedKeys.clear();
  }

  /**
   * Warm cache with critical data
   */
  async warmCache(): Promise<void> {
    this.logger.log('Starting cache warming...');
    const startTime = Date.now();

    try {
      // Warm data from registered providers
      await this.warmFromProviders();

      // Warm built-in data types
      if (this.config.warmPopularCourses) {
        await this.warmPopularCourses();
      }

      if (this.config.warmFeaturedContent) {
        await this.warmFeaturedContent();
      }

      if (this.config.warmSystemConfig) {
        await this.warmSystemConfig();
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Cache warming completed in ${duration}ms. Warmed ${this.warmedKeys.size} keys.`,
      );
    } catch (error) {
      this.logger.error('Cache warming failed', error);
      throw error;
    }
  }

  /**
   * Warm data from registered providers
   */
  private async warmFromProviders(): Promise<void> {
    for (const provider of this.dataProviders) {
      try {
        const items = await provider.getWarmableData();
        for (const item of items) {
          await this.cachingService.set(item.key, item.data, item.ttl);
          this.trackWarmedKey(item.key, 'provider');
        }
      } catch (error) {
        this.logger.warn('Failed to warm data from provider', error);
      }
    }
  }

  /**
   * Warm popular courses
   * This is a placeholder - in production, this would fetch from CourseService
   */
  private async warmPopularCourses(): Promise<void> {
    this.logger.debug('Warming popular courses...');

    // Placeholder: In a real implementation, this would inject CourseService
    // and fetch actual popular courses
    const popularCoursesKey = `${CACHE_PREFIXES.POPULAR}:courses`;

    // Simulate warming with placeholder data
    const placeholderData = {
      courses: [],
      warmedAt: new Date().toISOString(),
      type: 'popular',
    };

    await this.cachingService.set(popularCoursesKey, placeholderData, CACHE_TTL.POPULAR_COURSES);

    this.trackWarmedKey(popularCoursesKey, 'popular_courses');
    this.logger.debug(`Warmed popular courses key: ${popularCoursesKey}`);
  }

  /**
   * Warm featured content
   */
  private async warmFeaturedContent(): Promise<void> {
    this.logger.debug('Warming featured content...');

    const featuredKey = `${CACHE_PREFIXES.FEATURED}:content`;

    const placeholderData = {
      content: [],
      warmedAt: new Date().toISOString(),
      type: 'featured',
    };

    await this.cachingService.set(featuredKey, placeholderData, CACHE_TTL.STATIC_CONTENT);

    this.trackWarmedKey(featuredKey, 'featured_content');
    this.logger.debug(`Warmed featured content key: ${featuredKey}`);
  }

  /**
   * Warm system configuration
   */
  private async warmSystemConfig(): Promise<void> {
    this.logger.debug('Warming system configuration...');

    const configKey = CACHE_PREFIXES.SYSTEM_CONFIG;

    const configData = {
      version: this.configService.get<string>('npm_package_version') || '1.0.0',
      environment: this.configService.get<string>('NODE_ENV') || 'development',
      warmedAt: new Date().toISOString(),
    };

    await this.cachingService.set(configKey, configData, CACHE_TTL.STATIC_CONTENT);

    this.trackWarmedKey(configKey, 'system_config');
    this.logger.debug(`Warmed system config key: ${configKey}`);
  }

  /**
   * Schedule periodic cache warming
   */
  private schedulePeriodicWarmup(): void {
    // Refresh warmed data every 30 minutes
    const interval = 30 * 60 * 1000;

    this.warmupInterval = setInterval(async () => {
      this.logger.debug('Running scheduled cache warming...');
      try {
        await this.warmCache();
      } catch (error) {
        this.logger.error('Scheduled cache warming failed', error);
      }
    }, interval);
  }

  /**
   * Track a warmed key
   */
  private trackWarmedKey(key: string, type: string): void {
    this.warmedKeys.set(key, {
      key,
      type,
      timestamp: new Date(),
    });
  }

  /**
   * Get statistics about warmed keys
   */
  getStats(): {
    totalKeys: number;
    byType: Record<string, number>;
    lastWarmup: Date | null;
  } {
    const byType: Record<string, number> = {};
    let lastWarmup: Date | null = null;

    for (const warmed of this.warmedKeys.values()) {
      byType[warmed.type] = (byType[warmed.type] || 0) + 1;

      if (!lastWarmup || warmed.timestamp > lastWarmup) {
        lastWarmup = warmed.timestamp;
      }
    }

    return {
      totalKeys: this.warmedKeys.size,
      byType,
      lastWarmup,
    };
  }

  /**
   * Force refresh all warmed data
   */
  async refreshAll(): Promise<void> {
    this.logger.log('Force refreshing all warmed data...');
    this.warmedKeys.clear();
    await this.warmCache();
  }

  /**
   * Check if a key was warmed
   */
  isWarmed(key: string): boolean {
    return this.warmedKeys.has(key);
  }

  /**
   * Get all warmed keys
   */
  getWarmedKeys(): IWarmedData[] {
    return Array.from(this.warmedKeys.values());
  }
}
