import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getSharedRedisClient } from '../../config/cache.config';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Issue #837 — shared, high-availability-aware Redis connection.
 *
 * Provides a single ioredis client behind the `REDIS_CLIENT` token so every
 * Redis-backed feature module (session, caching, threat detection, ...)
 * reuses the same connection instead of each opening its own socket.
 *
 * The underlying connection topology is selected from environment
 * configuration (see `getRedisDeploymentMode` in `config/cache.config.ts`):
 *
 *  - `REDIS_CLUSTER_NODES` set  → Redis Cluster (sharding)
 *  - `REDIS_SENTINEL_HOSTS` set → Redis Sentinel (HA failover)
 *  - neither set                → standalone `REDIS_HOST`/`REDIS_PORT`
 *
 * ioredis handles Sentinel/Cluster failover transparently (it re-resolves
 * the current master via Sentinel, or refreshes cluster slot ownership, and
 * transparently redirects in-flight commands) — no application restart is
 * required when a replica is promoted.
 *
 * `RedisModule.forRoot()` is safe to import from multiple feature modules:
 * NestJS de-duplicates dynamic module registrations with identical shape,
 * and `getSharedRedisClient` itself is backed by a process-wide singleton,
 * so only one physical connection is ever opened regardless of how many
 * modules import it.
 */
@Global()
@Module({})
export class RedisModule {
  static forRoot(): DynamicModule {
    return {
      module: RedisModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: REDIS_CLIENT,
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => getSharedRedisClient(configService),
        },
      ],
      exports: [REDIS_CLIENT],
    };
  }
}
