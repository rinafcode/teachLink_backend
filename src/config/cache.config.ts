import { CacheModuleOptions } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';

/**
 * #156 – Cache configuration
 *
 * Used by CacheModule.registerAsync() in AppModule.
 * All values can be overridden via environment variables.
 *
 * Environment variables:
 *  REDIS_HOST        – default: localhost
 *  REDIS_PORT        – default: 6379
 *  REDIS_PASSWORD    – default: (none)
 *  REDIS_DB          – default: 0
 *  CACHE_TTL_SECONDS – default: 300 (5 minutes)
 *  CACHE_MAX_ITEMS   – default: 1000
 */
export const cacheConfig = async (): Promise<CacheModuleOptions> => ({
  store: await redisStore({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD ?? undefined,
    db: Number(process.env.REDIS_DB ?? 0),
    // Reconnect automatically on disconnect
    retryStrategy: (times: number) => Math.min(times * 100, 3000),
  }),
  ttl: Number(process.env.CACHE_TTL_SECONDS ?? 300) * 1000, // cache-manager v5 uses ms
  max: Number(process.env.CACHE_MAX_ITEMS ?? 1000),
});

/** Named TTL presets for use with @CacheTTL() on specific routes */
export const CacheTTL = {
  /** 1 minute – fast-moving data (notifications, feeds) */
  SHORT: 60,
  /** 5 minutes – default (topics, search results) */
  DEFAULT: 300,
  /** 30 minutes – stable data (user profiles, categories) */
  LONG: 1800,
  /** 24 hours – near-static data (platform config, plans) */
  STATIC: 86400,
} as const;