import { ShardConfig, ShardGroupConfig, ShardingConfig } from '../config/shard.config';
import { ShardHash } from '../hash/shard.hash';
import { Logger } from '@nestjs/common';

/**
 * Shard Router
 * Routes database operations to the correct shard based on shard key
 */
export class ShardRouter {
  private readonly logger = new Logger(ShardRouter.name);
  private hashRing!: ShardHash;
  private shardConfigs: Map<string, ShardConfig> = new Map();
  private shardGroupConfigs: Map<string, ShardGroupConfig> = new Map();
  private explicitMappings: Map<string, string> = new Map();

  constructor(private config: ShardingConfig) {
    this.initialize(config);
  }

  /**
   * Initialize the router with configuration
   */
  private initialize(config: ShardingConfig): void {
    this.shardConfigs = new Map(Object.entries(config.shards));
    this.shardGroupConfigs = new Map(Object.entries(config.shardGroups));
    this.explicitMappings = new Map(Object.entries(config.shardMappings));

    const shards = Object.keys(config.shards);
    const weights = new Map<string, number>();

    for (const [shardId, shard] of this.shardConfigs) {
      weights.set(shardId, shard.weight);
    }

    this.hashRing = new ShardHash(shards, weights, config.virtualNodesPerShard);

    this.logger.log(`Shard router initialized with ${shards.length} shards`);
  }

  /**
   * Route a key to a shard
   */
  route(key: string, group: string = 'primary'): string {
    // Check explicit mappings first
    const explicitShard = this.explicitMappings.get(key);
    if (explicitShard) {
      this.logger.debug(`Explicit mapping: ${key} -> ${explicitShard}`);
      if (this.isShardActive(explicitShard)) {
        return explicitShard;
      }

      if (this.config.fallbackOnShardFailure) {
        this.logger.warn(`Shard ${explicitShard} is not active, using default`);
        return this.config.defaultShard;
      }
      throw new Error(`Shard ${explicitShard} is not active and fallback is disabled`);
    }

    // Use consistent hashing for distribution
    const shardGroup = this.shardGroupConfigs.get(group);
    if (!shardGroup) {
      throw new Error(`Shard group ${group} not found`);
    }

    let primaryShard: string;

    switch (shardGroup.strategy) {
      case 'hash':
        primaryShard = this.hashRing.getShard(key);
        break;
      case 'range':
        primaryShard = this.routeByRange(key, shardGroup);
        break;
      case 'list':
        primaryShard = this.routeByList(key, shardGroup);
        break;
      case 'composite':
        primaryShard = this.routeByComposite(key, shardGroup);
        break;
      default:
        primaryShard = this.hashRing.getShard(key);
    }

    // Verify shard is active
    if (!this.isShardActive(primaryShard)) {
      if (this.config.fallbackOnShardFailure) {
        this.logger.warn(`Primary shard ${primaryShard} is not active, using default`);
        return this.config.defaultShard;
      }
      throw new Error(`Shard ${primaryShard} is not active and fallback is disabled`);
    }

    this.logger.debug(`Routed key ${key} to shard ${primaryShard}`);
    return primaryShard;
  }

  /**
   * Get all shards for a key (for replication or fault tolerance)
   */
  routeReplicas(key: string, group: string = 'primary'): string[] {
    const shardGroup = this.shardGroupConfigs.get(group);
    if (!shardGroup) {
      throw new Error(`Shard group ${group} not found`);
    }

    if (!shardGroup.replication) {
      return [this.route(key, group)];
    }

    const replicas = this.hashRing.getShards(key, 3); // Get 3 replicas
    return replicas.filter((shard) => this.isShardActive(shard));
  }

  /**
   * Route by range strategy
   */
  private routeByRange(key: string, _group: ShardGroupConfig): string {
    // For numeric keys, distribute by range
    const numericKey = parseInt(key, 10);
    if (isNaN(numericKey)) {
      return this.hashRing.getShard(key);
    }

    // Use hash as fallback for range-based routing
    return this.hashRing.getShard(key);
  }

  /**
   * Route by list strategy
   */
  private routeByList(key: string, _group: ShardGroupConfig): string {
    // Use predefined mappings for list strategy
    return this.hashRing.getShard(key);
  }

  /**
   * Route by composite strategy
   */
  private routeByComposite(key: string, _group: ShardGroupConfig): string {
    // Combine multiple strategies
    return this.hashRing.getShard(key);
  }

  /**
   * Check if a shard is active
   */
  isShardActive(shardId: string): boolean {
    const shard = this.shardConfigs.get(shardId);
    return shard?.status === 'active';
  }

  /**
   * Get shard configuration
   */
  getShardConfig(shardId: string): ShardConfig | undefined {
    return this.shardConfigs.get(shardId);
  }

  /**
   * Get all active shards
   */
  getActiveShards(group: string = 'primary'): string[] {
    const shardGroup = this.shardGroupConfigs.get(group);
    if (!shardGroup) {
      return [];
    }

    return shardGroup.shards.filter((shardId) => this.isShardActive(shardId));
  }

  /**
   * Get all available shards
   */
  getAllShards(): string[] {
    return Array.from(this.shardConfigs.keys());
  }

  /**
   * Get shard distribution statistics
   */
  getDistribution(): Map<string, number> {
    return this.hashRing.getDistribution();
  }

  /**
   * Add explicit mapping for a key to shard
   */
  addMapping(key: string, shardId: string): void {
    if (!this.isShardActive(shardId)) {
      throw new Error(`Cannot map to inactive shard ${shardId}`);
    }
    this.explicitMappings.set(key, shardId);
    this.logger.log(`Added mapping: ${key} -> ${shardId}`);
  }

  /**
   * Remove explicit mapping
   */
  removeMapping(key: string): void {
    this.explicitMappings.delete(key);
  }

  /**
   * Update shard status
   */
  updateShardStatus(shardId: string, status: 'active' | 'inactive' | 'maintenance'): void {
    const shard = this.shardConfigs.get(shardId);
    if (shard) {
      shard.status = status;
      this.logger.log(`Updated shard ${shardId} status to ${status}`);
    }
  }

  /**
   * Rebuild hash ring (useful after configuration changes)
   */
  rebuild(): void {
    this.initialize(this.config);
  }
}
