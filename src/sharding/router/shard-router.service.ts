import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  ShardConfig,
  ShardNode,
  ShardRoutingResult,
  ShardStrategy,
} from '../interfaces/shard.interface';
import { ShardConfigService } from '../shard-config.service';

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
export class ShardRouter {
  private readonly logger = new Logger(ShardRouter.name);
  private readonly VIRTUAL_NODES_PER_SHARD = 150;
  private readonly MAX_UINT32 = 0xffffffff;

  /** Sorted list of virtual-node → shard mappings for consistent hashing */
  private ring: ShardNode[] = [];

  /** Range buckets: [min, max) → shardId */
  private rangeBuckets: Array<{ min: number; max: number; shardId: string }> = [];

  constructor(private readonly shardConfigService: ShardConfigService) {
    this.rebuildRing();
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

    let shard: ShardConfig;

    switch (strategy) {
      case ShardStrategy.TENANT_BASED:
        shard = this.routeByTenant(key);
        break;
      case ShardStrategy.RANGE_BASED:
        shard = this.routeByRange(key);
        break;
      case ShardStrategy.HASH_BASED:
      default:
        shard = this.routeByHash(key);
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
  }

  /**
   * Rebuild the consistent-hash ring.
   * Call this after adding/removing shards or changing their weights.
   */
  rebuildRing(): void {
    const activeShards = this.shardConfigService.getActiveShards();
    if (activeShards.length === 0) {
      this.logger.warn('No active shards available — consistent-hash ring is empty');
      this.ring = [];
      return;
    }

    const nodes: ShardNode[] = [];

    for (const shard of activeShards) {
      // Scale virtual-node count by weight (100 = default)
      const vnodeCount = Math.round((this.VIRTUAL_NODES_PER_SHARD * shard.weight) / 100);

      for (let i = 0; i < vnodeCount; i++) {
        const hash = this.hash32(`${shard.id}:vnode-${i}`);
        nodes.push({ shardId: shard.id, virtualNode: hash });
      }
    }

    // Sort ascending by virtual-node position
    nodes.sort((a, b) => a.virtualNode - b.virtualNode);
    this.ring = nodes;

    this.logger.log(
      `Consistent-hash ring rebuilt with ${this.ring.length} virtual nodes ` +
        `across ${activeShards.length} active shard(s)`,
    );
  }

  /**
   * Configure range buckets for RANGE_BASED routing.
   * @param buckets Ordered, non-overlapping range definitions
   */
  setRangeBuckets(buckets: Array<{ min: number; max: number; shardId: string }>): void {
    this.rangeBuckets = [...buckets].sort((a, b) => a.min - b.min);
    this.logger.log(`Range buckets configured: ${JSON.stringify(this.rangeBuckets)}`);
  }

  // ---------------------------------------------------------------------------
  // Strategy implementations
  // ---------------------------------------------------------------------------

  private routeByHash(key: string): ShardConfig {
    if (this.ring.length === 0) {
      throw new Error('ShardRouter: consistent-hash ring is empty — no active shards');
    }

    const keyHash = this.hash32(key);
    const idx = this.findRingPosition(keyHash);
    const shardId = this.ring[idx].shardId;

    const shard = this.shardConfigService.getShardById(shardId);
    if (!shard) {
      throw new Error(`ShardRouter: shard "${shardId}" not found in configuration`);
    }
    return shard;
  }

  private routeByTenant(tenantKey: string): ShardConfig {
    // Tenant keys are expected in the form "tenant:<tenantId>:<entityKey>" or just a tenantId.
    // We normalise by stripping the prefix and hashing the tenant segment only
    // so that all data for a given tenant always lands on the same shard.
    const tenantId = tenantKey.replace(/^tenant:/, '').split(':')[0];
    return this.routeByHash(`tenant:${tenantId}`);
  }

  private routeByRange(key: string): ShardConfig {
    const numeric = parseInt(key, 10);
    if (isNaN(numeric)) {
      this.logger.warn(`RANGE_BASED routing: non-numeric key "${key}" — falling back to hash`);
      return this.routeByHash(key);
    }

    if (this.rangeBuckets.length === 0) {
      this.logger.warn('RANGE_BASED routing: no range buckets configured — falling back to hash');
      return this.routeByHash(key);
    }

    const bucket = this.rangeBuckets.find((b) => numeric >= b.min && numeric < b.max);
    if (!bucket) {
      this.logger.warn(
        `RANGE_BASED routing: key ${numeric} falls outside all buckets — falling back to hash`,
      );
      return this.routeByHash(key);
    }

    const shard = this.shardConfigService.getShardById(bucket.shardId);
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
  private findRingPosition(hash: number): number {
    let lo = 0;
    let hi = this.ring.length - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (this.ring[mid].virtualNode < hash) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return lo % this.ring.length; // wrap around
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
