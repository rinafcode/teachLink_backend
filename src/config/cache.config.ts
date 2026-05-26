import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { redisStore } from 'cache-manager-redis-store';

let sharedRedisClient: Redis | null = null;

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value || '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const getConfigValue = (key: string, fallback: string, configService?: ConfigService): string => {
  if (configService) {
    return configService.get<string>(key) || fallback;
  }

  return process.env[key] || fallback;
};

export const getRedisOptions = (configService?: ConfigService): RedisOptions => {
  const retryBaseDelayMs = parseNumber(
    getConfigValue('REDIS_RETRY_BASE_DELAY_MS', '100', configService),
    100,
  );
  const retryMaxDelayMs = parseNumber(
    getConfigValue('REDIS_RETRY_MAX_DELAY_MS', '2000', configService),
    2000,
  );

  return {
    host: getConfigValue('REDIS_HOST', 'localhost', configService),
    port: parseNumber(getConfigValue('REDIS_PORT', '6379', configService), 6379),
    maxRetriesPerRequest: parseNumber(
      getConfigValue('REDIS_MAX_RETRIES_PER_REQUEST', '3', configService),
      3,
    ),
    enableReadyCheck: true,
    lazyConnect: false,
    enableAutoPipelining: true,
    connectTimeout: parseNumber(
      getConfigValue('REDIS_CONNECT_TIMEOUT_MS', '10000', configService),
      10000,
    ),
    keepAlive: parseNumber(getConfigValue('REDIS_KEEPALIVE_MS', '30000', configService), 30000),
    retryStrategy: (attempt): number | null => {
      if (attempt > parseNumber(getConfigValue('REDIS_RETRY_ATTEMPTS', '10', configService), 10)) {
        return null;
      }

      return Math.min(attempt * retryBaseDelayMs, retryMaxDelayMs);
    },
  };
};

export const getSharedRedisClient = (configService?: ConfigService): Redis => {
  if (sharedRedisClient && sharedRedisClient.status !== 'end') {
    return sharedRedisClient;
  }

  sharedRedisClient = new Redis(getRedisOptions(configService));
  sharedRedisClient.on('error', () => {
    // Prevent unhandled error events when Redis is temporarily unavailable.
  });

  return sharedRedisClient;
};

export const cacheConfig = {
  isGlobal: true,
  store: redisStore,
  host: getConfigValue('REDIS_HOST', 'localhost'),
  port: parseNumber(getConfigValue('REDIS_PORT', '6379'), 6379),
  ttl: parseInt(process.env.REDIS_TTL || '60', 10),
};
export const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'teachlink-session-secret',
    name: process.env.SESSION_COOKIE_NAME || 'teachlink.sid',
    prefix: process.env.SESSION_PREFIX || 'sess:',
    ttlSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '604800', 10),
    cookieMaxAgeMs: parseInt(process.env.SESSION_COOKIE_MAX_AGE_MS || '604800000', 10),
    secureCookies: process.env.NODE_ENV === 'production',
    stickySessionsRequired: (process.env.STICKY_SESSIONS_REQUIRED || 'true') === 'true',
    trustProxy: (process.env.TRUST_PROXY || 'true') === 'true',
};
export const distributedLockConfig = {
    ttlMs: parseInt(process.env.SESSION_LOCK_TTL_MS || '5000', 10),
    maxRetries: parseInt(process.env.SESSION_LOCK_MAX_RETRIES || '5', 10),
    retryDelayMs: parseInt(process.env.SESSION_LOCK_RETRY_DELAY_MS || '120', 10),
};
