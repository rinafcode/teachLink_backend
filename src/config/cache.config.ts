import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { redisStore } from 'cache-manager-redis-store';

/**
 * =====================================================
 * 🔧 CORE TYPES
 * =====================================================
 */

type NumericConfig = {
  key: string;
  fallback: number;
};

type StringConfig = {
  key: string;
  fallback: string;
};

/**
 * =====================================================
 * 🧠 CONFIG UTILITY CLASS (centralized logic)
 * =====================================================
 */
class EnvReader {
  constructor(private readonly configService?: ConfigService) {}

  getString({ key, fallback }: StringConfig): string {
    if (this.configService) {
      return this.configService.get<string>(key) || fallback;
    }
    return process.env[key] || fallback;
  }

  getNumber({ key, fallback }: NumericConfig): number {
    const value = this.getString({ key, fallback: String(fallback) });
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  getBoolean(key: string, fallback: boolean): boolean {
    const value = this.getString({ key, fallback: String(fallback) });
    return value.toLowerCase() === 'true';
  }
}

/**
 * =====================================================
 * 🧱 REDIS CLIENT SINGLETON MANAGER
 * =====================================================
 */

class RedisClientManager {
  private static instance: Redis | null = null;

  static get(config: ConfigService | undefined): Redis {
    if (this.instance && this.instance.status !== 'end') {
      return this.instance;
    }

    const env = new EnvReader(config);

    const retryBase = env.getNumber({
      key: 'REDIS_RETRY_BASE_DELAY_MS',
      fallback: 100,
    });

    const retryMax = env.getNumber({
      key: 'REDIS_RETRY_MAX_DELAY_MS',
      fallback: 2000,
    });

    const retryAttempts = env.getNumber({
      key: 'REDIS_RETRY_ATTEMPTS',
      fallback: 10,
    });

    const options: RedisOptions = {
      host: env.getString({ key: 'REDIS_HOST', fallback: 'localhost' }),
      port: env.getNumber({ key: 'REDIS_PORT', fallback: 6379 }),

      maxRetriesPerRequest: env.getNumber({
        key: 'REDIS_MAX_RETRIES_PER_REQUEST',
        fallback: 3,
      }),

      enableReadyCheck: true,
      lazyConnect: false,
      enableAutoPipelining: true,

      connectTimeout: env.getNumber({
        key: 'REDIS_CONNECT_TIMEOUT_MS',
        fallback: 10000,
      }),

      keepAlive: env.getNumber({
        key: 'REDIS_KEEPALIVE_MS',
        fallback: 30000,
      }),

      retryStrategy: (attempt: number) => {
        if (attempt > retryAttempts) return null;

        const delay = Math.min(attempt * retryBase, retryMax);
        return delay;
      },
    };

    this.instance = new Redis(options);

    this.instance.on('error', (err) => {
      // centralized safe error handling
      // could plug in logger here
    });

    return this.instance;
  }
}

/**
 * =====================================================
 * 🔴 PUBLIC API (Redis)
 * =====================================================
 */

export const getSharedRedisClient = (
  configService?: ConfigService,
): Redis => {
  return RedisClientManager.get(configService);
};

/**
 * =====================================================
 * 📦 CACHE CONFIG (STRUCTURED)
 * =====================================================
 */

export const createCacheConfig = (configService?: ConfigService) => {
  const env = new EnvReader(configService);

  return {
    isGlobal: true,
    store: redisStore,

    host: env.getString({ key: 'REDIS_HOST', fallback: 'localhost' }),
    port: env.getNumber({ key: 'REDIS_PORT', fallback: 6379 }),

    ttl: env.getNumber({ key: 'REDIS_TTL', fallback: 60 }),
  };
};

/**
 * =====================================================
 * 🔐 SESSION CONFIG (CLEAN STRUCTURE)
 * =====================================================
 */

export const createSessionConfig = (configService?: ConfigService) => {
  const env = new EnvReader(configService);

  return {
    secret: env.getString({
      key: 'SESSION_SECRET',
      fallback: 'teachlink-session-secret',
    }),

    name: env.getString({
      key: 'SESSION_COOKIE_NAME',
      fallback: 'teachlink.sid',
    }),

    prefix: env.getString({
      key: 'SESSION_PREFIX',
      fallback: 'sess:',
    }),

    ttlSeconds: env.getNumber({
      key: 'SESSION_TTL_SECONDS',
      fallback: 604800,
    }),

    cookieMaxAgeMs: env.getNumber({
      key: 'SESSION_COOKIE_MAX_AGE_MS',
      fallback: 604800000,
    }),

    secureCookies:
      process.env.NODE_ENV === 'production',

    stickySessionsRequired: env.getBoolean(
      'STICKY_SESSIONS_REQUIRED',
      true,
    ),

    trustProxy: env.getBoolean('TRUST_PROXY', true),
  };
};

/**
 * =====================================================
 * 🔒 DISTRIBUTED LOCK CONFIG
 * =====================================================
 */

export const createDistributedLockConfig = (configService?: ConfigService) => {
  const env = new EnvReader(configService);

  return {
    ttlMs: env.getNumber({
      key: 'SESSION_LOCK_TTL_MS',
      fallback: 5000,
    }),

    maxRetries: env.getNumber({
      key: 'SESSION_LOCK_MAX_RETRIES',
      fallback: 5,
    }),

    retryDelayMs: env.getNumber({
      key: 'SESSION_LOCK_RETRY_DELAY_MS',
      fallback: 120,
    }),
  };
};