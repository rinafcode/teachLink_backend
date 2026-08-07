import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { Counter, Histogram, register as defaultRegistry } from 'prom-client';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import { Permission } from './entities/permission.entity';

export const RBAC_CACHE_VERSION = 'v1';
export const RBAC_CACHE_PREFIX = `rbac:permissions:${RBAC_CACHE_VERSION}:`;
export const RBAC_INVALIDATION_CHANNEL = `rbac:invalidation:${RBAC_CACHE_VERSION}`;
export const RBAC_CACHE_TTL = 3600; // 1 hour

@Injectable()
export class RbacCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RbacCacheService.name);
  private subscriber: Redis;
  private readonly localCache = new Map<string, Permission[]>();

  private hitCounter: Counter<string>;
  private missCounter: Counter<string>;
  private propagationLatency: Histogram<string>;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    this.subscriber = this.redis.duplicate();
    this.initMetrics();
  }

  private initMetrics() {
    this.hitCounter =
      (defaultRegistry.getSingleMetric('rbac_cache_hits_total') as Counter<string>) ||
      new Counter({
        name: 'rbac_cache_hits_total',
        help: 'Total number of RBAC cache hits',
        registers: [defaultRegistry],
      });

    this.missCounter =
      (defaultRegistry.getSingleMetric('rbac_cache_misses_total') as Counter<string>) ||
      new Counter({
        name: 'rbac_cache_misses_total',
        help: 'Total number of RBAC cache misses',
        registers: [defaultRegistry],
      });

    this.propagationLatency =
      (defaultRegistry.getSingleMetric(
        'rbac_revocation_propagation_latency_ms',
      ) as Histogram<string>) ||
      new Histogram({
        name: 'rbac_revocation_propagation_latency_ms',
        help: 'Latency of propagating RBAC cache revocations',
        buckets: [1, 5, 10, 50, 100, 500, 1000],
        registers: [defaultRegistry],
      });
  }

  async onModuleInit() {
    await this.subscriber.subscribe(RBAC_INVALIDATION_CHANNEL, (err, count) => {
      if (err) {
        this.logger.error(`Failed to subscribe to ${RBAC_INVALIDATION_CHANNEL}:`, err.message);
      } else {
        this.logger.log(`Subscribed successfully to ${count} channel(s)`);
      }
    });

    this.subscriber.on('message', async (channel, message) => {
      if (channel === RBAC_INVALIDATION_CHANNEL) {
        try {
          const { roleId, all, timestamp } = JSON.parse(message);
          const latency = Date.now() - timestamp;

          if (all) {
            this.localCache.clear();
            this.logger.debug('Invalidated all roles in local cache');
          } else if (roleId) {
            this.localCache.delete(roleId);
            this.logger.debug(`Invalidated role ${roleId} in local cache`);
          }

          this.propagationLatency.observe(latency);
        } catch (err) {
          this.logger.error(`Error processing invalidation message: ${(err as Error).message}`);
        }
      }
    });
  }

  async onModuleDestroy() {
    await this.subscriber.unsubscribe(RBAC_INVALIDATION_CHANNEL);
    this.subscriber.disconnect();
  }

  async getRolePermissions(roleId: string): Promise<Permission[] | null> {
    if (this.localCache.has(roleId)) {
      this.hitCounter.inc();
      return this.localCache.get(roleId) ?? null;
    }

    const key = `${RBAC_CACHE_PREFIX}${roleId}`;
    const cached = await this.redis.get(key);

    if (cached) {
      this.hitCounter.inc();
      const parsed = JSON.parse(cached) as Permission[];
      this.localCache.set(roleId, parsed);
      return parsed;
    }

    this.missCounter.inc();
    return null;
  }

  async setRolePermissions(roleId: string, permissions: Permission[]): Promise<void> {
    this.localCache.set(roleId, permissions);
    const key = `${RBAC_CACHE_PREFIX}${roleId}`;
    await this.redis.set(key, JSON.stringify(permissions), 'EX', RBAC_CACHE_TTL);
  }

  async invalidateRole(roleId: string): Promise<void> {
    const key = `${RBAC_CACHE_PREFIX}${roleId}`;
    await this.redis.del(key);
    const message = JSON.stringify({ roleId, timestamp: Date.now() });
    await this.redis.publish(RBAC_INVALIDATION_CHANNEL, message);
  }

  async invalidateAllRoles(): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${RBAC_CACHE_PREFIX}*`,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');

    const message = JSON.stringify({ all: true, timestamp: Date.now() });
    await this.redis.publish(RBAC_INVALIDATION_CHANNEL, message);
  }
}
