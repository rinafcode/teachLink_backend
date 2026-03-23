import { redisStore } from 'cache-manager-redis-store';

export const cacheConfig = {
  isGlobal: true,
  store: redisStore,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
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
