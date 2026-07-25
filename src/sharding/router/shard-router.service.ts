import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  ShardConfig,
  ShardNode,
  ShardRoutingResult,
  ShardStrategy,
} from '../interfaces/shard.interface';
import { ShardConfigService } from '../shard-config.service';

type RangeBucket = { min: number; max: number; shardId: string };

interface RoutingSnapshot {
  ring: ShardNode[];
  rangeBuckets: RangeBucket[];
  shardsById: Map<string, ShardConfig>;
}

class AsyncReadWriteLock {
  private activeReaders = 0;
  private activeWriter = false;
  private waitingWriters: Array<() => void> = [];

  async write<T>(operation: () => T | Promise<T>): Promise<T> {
    await this.acquireWrite();
    try {
      return await operation();
    } finally {
      this.releaseWrite();
    }
  }

  read<T>(operation: () => T): T {
    this.activeReaders++;
    try {
      return operation();
    } finally {
      this.releaseRead();
    }
  }

  private async acquireWrite(): Promise<void> {
    if (!this.activeWriter && this.activeReaders === 0) {
      this.activeWriter = true;
      return;
    }

    await new Promise<void>((resolve) => this.waitingWriters.push(resolve));
    this.activeWriter = true;
  }

  private releaseRead(): void {
    this.activeReaders--;
    this.drainWriters();
  }

  private releaseWrite(): void {
    this.activeWriter = false;
    this.drainWriters();
  }

  private drainWriters(): void {
    if (this.activeWriter || this.activeReaders > 0 || this.waitingWriters.length === 0) {
      return;
    }

    const nextWriter = this.waitingWriters.shift();
    nextWriter?.();
  }
}

/**
 * ShardRouter
 *
 * Implements multiple shard routing strategies:
 *
 *  1. HASH_BASED   — consistent-hash ring on a shard key (default)
 *  2. TENANT_BASED — tenant-prefix aware hash routing
 *  3. RANGE_BASED  — explicit numeric-range bucket mapping
 *  4. READ_REPLICA — routes reads to a weighted replica when available
 *
 * The consistent-hash ring uses 150 virtual nodes per physical shard to
 * ensure an even key distribution even with a small shard count.
 */
@Injectable()
export class ShardRouter implements OnModuleDestroy {
  private readonly logger = new Logger(ShardRouter.name);
  private readonly VIRTUAL_NODES_PER_SHARD = 150;
  private readonly MAX_UINT32 = 0xffffffff;
  private readonly routingLock = new AsyncReadWriteLock();
  private unsubscribeConfigUpdates?: () => void;

  /** Current immutable routing view used by route() calls */
  private routingSnapshot: RoutingSnapshot = {
    ring: [],
    rangeBuckets: [],
    shardsById: new Map(),
  };

  constructor(private readonly shardConfigService: ShardConfigService) {
    this.unsubscribeConfigUpdates = this.shardConfigService.onConfigUpdated(() =>
      this.reloadConfig(),
    );
    this.rebuildRing();
  }

  onModuleDestroy(): void {
    this.unsubscribeConfigUpdates?.();
  }

  // ---------------------------------------------------------------------------
  // Public routing API
  // ---------------------------------------------------------------------------

  /**
   * Resolve a shard for the given key using the specified strategy.
   * @param key      The routing key (e.g. userId, tenantId, courseId)
   * @param strategy Routing strategy — defaults to HASH_BASED
   * @param forRead  When true, attempts to route to a read replica
   */
  route(
    key: string,
    strategy: ShardStrategy = ShardStrategy.HASH_BASED,
    forRead = false,
  ): ShardRoutingResult {
    const start = Date.now();

    return this.routingLock.read(() => {
      const snapshot = this.routingSnapshot;
      let shard: ShardConfig;

      switch (strategy) {
        case ShardStrategy.TENANT_BASED:
          shard = this.routeByTenant(snapshot, key);
          break;
        case ShardStrategy.RANGE_BASED:
          shard = this.routeByRange(snapshot, key);
          break;
        case ShardStrategy.HASH_BASED:
        default:
          shard = this.routeByHash(snapshot, key);
          break;
      }

      const isReplica = false;
      if (forRead && shard.readReplicas?.length) {
        // Pick a replica using weighted random selection
        const replica = this.pickWeightedReplica(shard);
        if (replica) {
          // Return a synthetic ShardConfig representing the replica
          const replicaShard: ShardConfig = {
            ...shard,
            id: replica.id,
            host: replica.host,
            port: replica.port,
          };
          return {
            shard: replicaShard,
            isReplica: true,
            routingKey: key,
            resolutionTimeMs: Date.now() - start,
          };
        }
      }

      return {
        shard,
        isReplica,
        routingKey: key,
        resolutionTimeMs: Date.now() - start,
      };
    });
  }

  /**
   * Rebuild the consistent-hash ring.
   * Call this after adding/removing shards or changing their weights.
   */
  rebuildRing(): void {
    const activeShards = this.shardConfigService.getActiveShards();
    const nextSnapshot = this.buildRoutingSnapshot(activeShards, this.routingSnapshot.rangeBuckets);
    this.routingSnapshot = nextSnapshot;

    if (nextSnapshot.ring.length === 0) {
      this.logger.warn('No active shards available — consistent-hash ring is empty');
      return;
    }

    this.logger.log(
      `Consistent-hash ring rebuilt with ${nextSnapshot.ring.length} virtual nodes ` +
        `across ${activeShards.length} active shard(s)`,
    );
  }

  /**
   * Reload shard configuration and atomically publish a new routing snapshot.
   */
  async reloadConfig(): Promise<void> {
    await this.routingLock.write(async () => {
      this.shardConfigService.reloadConfig();
      const activeShards = this.shardConfigService.getActiveShards();
      const nextSnapshot = this.buildRoutingSnapshot(
        activeShards,
        this.routingSnapshot.rangeBuckets,
      );
      this.routingSnapshot = nextSnapshot;

      if (nextSnapshot.ring.length === 0) {
        this.logger.warn('Shard config reload produced an empty consistent-hash ring');
        return;
      }

      this.logger.log(
        `Shard config reloaded; ring now has ${nextSnapshot.ring.length} virtual nodes ` +
          `across ${activeShards.length} active shard(s)`,
      );
    });
  }

  private buildRoutingSnapshot(
    activeShards: ShardConfig[],
    rangeBuckets: RangeBucket[],
  ): RoutingSnapshot {
    if (activeShards.length === 0) {
      return {
        ring: [],
        rangeBuckets: [...rangeBuckets],
        shardsById: new Map(),
      };
    }

    const nodes: ShardNode[] = [];
    const shardsById = new Map<string, ShardConfig>();

    for (const shard of activeShards) {
      shardsById.set(shard.id, shard);

      // Scale virtual-node count by weight (100 = default)
      const vnodeCount = Math.round((this.VIRTUAL_NODES_PER_SHARD * shard.weight) / 100);

      for (let i = 0; i < vnodeCount; i++) {
        const hash = this.hash32(`${shard.id}:vnode-${i}`);
        nodes.push({ shardId: shard.id, virtualNode: hash });
      }
    }

    // Sort ascending by virtual-node position
    nodes.sort((a, b) => a.virtualNode - b.virtualNode);

    return {
      ring: nodes,
      rangeBuckets: [...rangeBuckets],
      shardsById,
    };
  }

  /**
   * Configure range buckets for RANGE_BASED routing.
   * @param buckets Ordered, non-overlapping range definitions
   */
  setRangeBuckets(buckets: RangeBucket[]): void {
    const rangeBuckets = [...buckets].sort((a, b) => a.min - b.min);
    this.routingSnapshot = {
      ...this.routingSnapshot,
      rangeBuckets,
    };
    this.logger.log(`Range buckets configured: ${JSON.stringify(rangeBuckets)}`);
  }

  // ---------------------------------------------------------------------------
  // Strategy implementations
  // ---------------------------------------------------------------------------

  private routeByHash(snapshot: RoutingSnapshot, key: string): ShardConfig {
    if (snapshot.ring.length === 0) {
      throw new Error('ShardRouter: consistent-hash ring is empty — no active shards');
    }

    const keyHash = this.hash32(key);
    const idx = this.findRingPosition(snapshot.ring, keyHash);
    const shardId = snapshot.ring[idx].shardId;

    const shard = snapshot.shardsById.get(shardId);
    if (!shard) {
      throw new Error(`ShardRouter: shard "${shardId}" not found in configuration`);
    }
    return shard;
  }

  private routeByTenant(snapshot: RoutingSnapshot, tenantKey: string): ShardConfig {
    // Tenant keys are expected in the form "tenant:<tenantId>:<entityKey>" or just a tenantId.
    // We normalise by stripping the prefix and hashing the tenant segment only
    // so that all data for a given tenant always lands on the same shard.
    const tenantId = tenantKey.replace(/^tenant:/, '').split(':')[0];
    return this.routeByHash(snapshot, `tenant:${tenantId}`);
  }

  private routeByRange(snapshot: RoutingSnapshot, key: string): ShardConfig {
    const numeric = parseInt(key, 10);
    if (isNaN(numeric)) {
      this.logger.warn(`RANGE_BASED routing: non-numeric key "${key}" — falling back to hash`);
      return this.routeByHash(snapshot, key);
    }

    if (snapshot.rangeBuckets.length === 0) {
      this.logger.warn('RANGE_BASED routing: no range buckets configured — falling back to hash');
      return this.routeByHash(snapshot, key);
    }

    const bucket = snapshot.rangeBuckets.find((b) => numeric >= b.min && numeric < b.max);
    if (!bucket) {
      this.logger.warn(
        `RANGE_BASED routing: key ${numeric} falls outside all buckets — falling back to hash`,
      );
      return this.routeByHash(snapshot, key);
    }

    const shard = snapshot.shardsById.get(bucket.shardId);
    if (!shard) {
      throw new Error(`ShardRouter: range bucket points to unknown shard "${bucket.shardId}"`);
    }
    return shard;
  }

  // ---------------------------------------------------------------------------
  // Consistent-hash helpers
  // ---------------------------------------------------------------------------

  /**
   * Binary search for the first virtual-node at or after `hash`.
   * Wraps around to index 0 when hash exceeds the last virtual-node.
   */
  private findRingPosition(ring: ShardNode[], hash: number): number {
    let lo = 0;
    let hi = ring.length - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (ring[mid].virtualNode < hash) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return lo % ring.length; // wrap around
  }

  /** Deterministic 32-bit FNV-1a-style hash via Node's crypto module */
  private hash32(value: string): number {
    const buf = createHash('sha256').update(value).digest();
    // Read first 4 bytes as unsigned 32-bit integer, scaled to [0, MAX_UINT32]
    return buf.readUInt32BE(0);
  }

  // ---------------------------------------------------------------------------
  // Replica selection
  // ---------------------------------------------------------------------------

  private pickWeightedReplica(shard: ShardConfig) {
    const replicas = shard.readReplicas;
    if (!replicas || replicas.length === 0) return null;

    const totalWeight = replicas.reduce((sum, r) => sum + r.weight, 0);
    let rand = Math.random() * totalWeight;

    for (const replica of replicas) {
      rand -= replica.weight;
      if (rand <= 0) return replica;
    }
    return replicas[replicas.length - 1];
  }
}
