import { ConfigService } from '@nestjs/config';
import Redis, { Cluster, ClusterNode, RedisOptions } from 'ioredis';
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
 * 🌐 DEPLOYMENT TOPOLOGY
 * =====================================================
 */

export type RedisDeploymentMode = 'standalone' | 'sentinel' | 'cluster';

/**
 * Parses a comma-separated `host:port,host:port` list (as used by
 * `REDIS_SENTINEL_HOSTS` / `REDIS_CLUSTER_NODES`) into node descriptors.
 */
const parseHostPortList = (raw: string): { host: string; port: number }[] =>
  raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, portStr] = entry.split(':');
      const port = parseInt(portStr, 10);
      return { host, port: Number.isNaN(port) ? 6379 : port };
    });

/**
 * Determines which Redis topology to connect to based on env configuration.
 * Cluster takes precedence over Sentinel, which takes precedence over a
 * plain standalone connection, since both `*_NODES`/`*_HOSTS` vars are only
 * ever set intentionally by the operator.
 */
export const getRedisDeploymentMode = (configService?: ConfigService): RedisDeploymentMode => {
  const env = new EnvReader(configService);

  if (env.getString({ key: 'REDIS_CLUSTER_NODES', fallback: '' })) {
    return 'cluster';
  }

  if (env.getString({ key: 'REDIS_SENTINEL_HOSTS', fallback: '' })) {
    return 'sentinel';
  }

  return 'standalone';
};

/**
 * =====================================================
 * 🧱 REDIS CLIENT SINGLETON MANAGER
 * =====================================================
 */

class RedisClientManager {
  // `Cluster` only surfaces when REDIS_CLUSTER_NODES is configured. It is
  // exposed to callers as `Redis` (see `getSharedRedisClient`) because
  // `Cluster` implements the same command surface (get/set/multi/scan/eval/
  // zadd/...) that every current consumer relies on — see redis.module.ts
  // for the rationale.
  private static instance: Redis | Cluster | null = null;

  static get(config: ConfigService | undefined): Redis | Cluster {
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

    const retryStrategy = (attempt: number): number | null => {
      if (attempt > retryAttempts) return null;
      return Math.min(attempt * retryBase, retryMax);
    };

    const maxRetriesPerRequest = env.getNumber({
      key: 'REDIS_MAX_RETRIES_PER_REQUEST',
      fallback: 3,
    });

    const connectTimeout = env.getNumber({
      key: 'REDIS_CONNECT_TIMEOUT_MS',
      fallback: 10000,
    });

    const keepAlive = env.getNumber({
      key: 'REDIS_KEEPALIVE_MS',
      fallback: 30000,
    });

    const password = env.getString({ key: 'REDIS_PASSWORD', fallback: '' }) || undefined;

    const mode = getRedisDeploymentMode(config);

    if (mode === 'cluster') {
      const nodes: ClusterNode[] = parseHostPortList(
        env.getString({ key: 'REDIS_CLUSTER_NODES', fallback: '' }),
      );

      this.instance = new Redis.Cluster(nodes, {
        enableReadyCheck: true,
        clusterRetryStrategy: retryStrategy,
        redisOptions: {
          password,
          maxRetriesPerRequest,
          connectTimeout,
          keepAlive,
        },
      });
    } else if (mode === 'sentinel') {
      const sentinels = parseHostPortList(
        env.getString({ key: 'REDIS_SENTINEL_HOSTS', fallback: '' }),
      );
      const sentinelName = env.getString({ key: 'REDIS_SENTINEL_NAME', fallback: 'mymaster' });
      const sentinelPassword =
        env.getString({ key: 'REDIS_SENTINEL_PASSWORD', fallback: '' }) || undefined;

      const options: RedisOptions = {
        sentinels,
        name: sentinelName,
        sentinelPassword,
        password,

        maxRetriesPerRequest,
        enableReadyCheck: true,
        lazyConnect: false,
        enableAutoPipelining: true,
        connectTimeout,
        keepAlive,
        retryStrategy,
      };

      this.instance = new Redis(options);
    } else {
      const options: RedisOptions = {
        host: env.getString({ key: 'REDIS_HOST', fallback: 'localhost' }),
        port: env.getNumber({ key: 'REDIS_PORT', fallback: 6379 }),
        password,

        maxRetriesPerRequest,
        enableReadyCheck: true,
        lazyConnect: false,
        enableAutoPipelining: true,
        connectTimeout,
        keepAlive,
        retryStrategy,
      };

      this.instance = new Redis(options);
    }

    this.instance.on('error', (_err) => {
      // centralized safe error handling
      // could plug in logger here
    });

    return this.instance;
  }

  /** Test-only escape hatch: forces the next `get()` to build a fresh client. */
  static reset(): void {
    this.instance = null;
  }
}

/**
 * =====================================================
 * 🔴 PUBLIC API (Redis)
 * =====================================================
 */

/**
 * Returns the shared ioredis connection, lazily created on first use.
 *
 * Backed by a standalone connection, a Sentinel-monitored master, or a
 * Cluster, depending on `REDIS_CLUSTER_NODES` / `REDIS_SENTINEL_HOSTS` (see
 * `getRedisDeploymentMode`). The declared return type stays `Redis` for
 * source compatibility with existing call sites — `Cluster` implements the
 * same command surface they use (get/set/multi/scan/eval/zadd/duplicate/...).
 */
export const getSharedRedisClient = (configService?: ConfigService): Redis => {
  return RedisClientManager.get(configService) as Redis;
};

/** Test-only: clears the shared client singleton so the next call to
 * `getSharedRedisClient` re-reads env/ConfigService and builds a fresh
 * connection (standalone/sentinel/cluster). */
export const resetSharedRedisClientForTests = (): void => {
  RedisClientManager.reset();
};

export const getRedisOptions = (configService?: ConfigService): RedisOptions => {
  const env = new EnvReader(configService);
  return {
    host: env.getString({ key: 'REDIS_HOST', fallback: 'localhost' }),
    port: env.getNumber({ key: 'REDIS_PORT', fallback: 6379 }),
  };
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

    secureCookies: process.env.NODE_ENV === 'production',

    stickySessionsRequired: env.getBoolean('STICKY_SESSIONS_REQUIRED', true),

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
