/**
 * Database Sharding Interfaces
 *
 * Core type definitions for the TeachLink sharding system.
 * Supports horizontal scaling via tenant-based and hash-based routing.
 */

export enum ShardStrategy {
  /** Route by tenant ID — best for multi-tenant SaaS workloads */
  TENANT_BASED = 'tenant_based',
  /** Consistent hash on a shard key — best for user/content data */
  HASH_BASED = 'hash_based',
  /** Explicit range mapping — best for time-series or ordered data */
  RANGE_BASED = 'range_based',
  /** Read from replica, write to primary */
  READ_REPLICA = 'read_replica',
}

export enum ShardStatus {
  ACTIVE = 'active',
  DRAINING = 'draining',
  READONLY = 'readonly',
  OFFLINE = 'offline',
  REBALANCING = 'rebalancing',
}

export interface ShardConfig {
  /** Unique shard identifier, e.g. "shard-01" */
  id: string;
  /** Human-readable name */
  name: string;
  /** PostgreSQL host */
  host: string;
  /** PostgreSQL port */
  port: number;
  /** Database user */
  username: string;
  /** Database password */
  password: string;
  /** Database name on this shard */
  database: string;
  /** Maximum connection pool size for this shard */
  poolMax: number;
  /** Minimum connection pool size for this shard */
  poolMin: number;
  /** Operational status */
  status: ShardStatus;
  /** Weight for load-balancing (0–100) */
  weight: number;
  /** Geographic region tag, e.g. "us-east-1" */
  region?: string;
  /** Optional replica URLs for read scaling */
  readReplicas?: ReadReplicaConfig[];
  /** Metadata tags for this shard */
  tags?: Record<string, string>;
}

export interface ReadReplicaConfig {
  id: string;
  host: string;
  port: number;
  weight: number;
}

export interface ShardNode {
  shardId: string;
  /** Virtual node position in the consistent-hash ring (0–MAX_UINT32) */
  virtualNode: number;
}

export interface ShardRoutingResult {
  /** Resolved shard configuration */
  shard: ShardConfig;
  /** Was this routed to a read replica? */
  isReplica: boolean;
  /** The routing key that produced this decision */
  routingKey: string;
  /** Wall-clock time taken to resolve routing (ms) */
  resolutionTimeMs: number;
}

export interface ShardMigrationPlan {
  sourceShardId: string;
  targetShardId: string;
  entityType: string;
  estimatedRowCount: number;
  batchSize: number;
  /** Cron expression for migration window */
  migrationWindow?: string;
  /** Whether to run in dry-run (no writes) mode */
  dryRun: boolean;
}

export interface ShardMigrationStatus {
  planId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  migratedRows: number;
  totalRows: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface RebalancePlan {
  id: string;
  triggeredBy: 'manual' | 'auto' | 'threshold';
  migrations: ShardMigrationPlan[];
  createdAt: Date;
  /** Overall completion percentage (0–100) */
  progress: number;
}

export interface ShardHealthStatus {
  shardId: string;
  status: ShardStatus;
  activeConnections: number;
  poolUtilizationPercent: number;
  avgQueryLatencyMs: number;
  errorRatePercent: number;
  lastCheckedAt: Date;
}
