import { registerAs } from '@nestjs/config';

/**
 * Shard Configuration
 * Defines how data is distributed across multiple database shards
 */
export interface ShardConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  weight: number; // Relative weight for consistent hashing
  type: 'master' | 'slave';
  readOnly: boolean;
  status: 'active' | 'inactive' | 'maintenance';
  maxConnections: number;
  minConnections: number;
  timeout: number;
  retryAttempts: number;
}

export interface ShardGroupConfig {
  id: string;
  name: string;
  shards: string[]; // Array of shard IDs
  strategy: 'hash' | 'range' | 'list' | 'composite';
  replication: boolean;
  readFromReplicas: boolean;
  replicaReadStrategy: 'round-robin' | 'random' | 'least-connections';
}

export interface ShardingConfig {
  strategy: 'key-based' | 'range-based' | 'directory-based';
  keyField: string;
  shardKeyExtractor: string; // Function name or pattern to extract shard key
  hashAlgorithm: 'md5' | 'sha256' | 'murmur3' | 'crc32';
  virtualNodesPerShard: number; // For consistent hashing
  defaultShard: string;
  fallbackOnShardFailure: boolean;
  maxCrossShardRetries: number;
  enableCache: boolean;
  cacheTtl: number;
  shards: Record<string, ShardConfig>;
  shardGroups: Record<string, ShardGroupConfig>;
  shardMappings: Record<string, string>; // tenantId/entityKey -> shardId
}

export const shardConfig = registerAs('sharding', () => {
  const baseShards = {
    shard_00: {
      id: 'shard_00',
      name: 'Primary Shard',
      host: process.env.SHARD_00_HOST || process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.SHARD_00_PORT || process.env.DATABASE_PORT || '5432', 10),
      database: process.env.SHARD_00_NAME || process.env.DATABASE_NAME || 'teachlink_shard_00',
      username: process.env.SHARD_00_USER || process.env.DATABASE_USER || 'postgres',
      password: process.env.SHARD_00_PASSWORD || process.env.DATABASE_PASSWORD || 'postgres',
      weight: 100,
      type: 'master',
      readOnly: false,
      status: 'active',
      maxConnections: parseInt(process.env.SHARD_00_POOL_MAX || '30', 10),
      minConnections: parseInt(process.env.SHARD_00_POOL_MIN || '5', 10),
      timeout: parseInt(process.env.SHARD_00_TIMEOUT || '5000', 10),
      retryAttempts: parseInt(process.env.SHARD_00_RETRY_ATTEMPTS || '3', 10),
    },
    shard_01: {
      id: 'shard_01',
      name: 'Shard 1',
      host: process.env.SHARD_01_HOST || 'localhost',
      port: parseInt(process.env.SHARD_01_PORT || '5433', 10),
      database: process.env.SHARD_01_NAME || 'teachlink_shard_01',
      username: process.env.SHARD_01_USER || 'postgres',
      password: process.env.SHARD_01_PASSWORD || 'postgres',
      weight: 100,
      type: 'master',
      readOnly: false,
      status: 'active',
      maxConnections: parseInt(process.env.SHARD_01_POOL_MAX || '30', 10),
      minConnections: parseInt(process.env.SHARD_01_POOL_MIN || '5', 10),
      timeout: parseInt(process.env.SHARD_01_TIMEOUT || '5000', 10),
      retryAttempts: parseInt(process.env.SHARD_01_RETRY_ATTEMPTS || '3', 10),
    },
    shard_02: {
      id: 'shard_02',
      name: 'Shard 2',
      host: process.env.SHARD_02_HOST || 'localhost',
      port: parseInt(process.env.SHARD_02_PORT || '5434', 10),
      database: process.env.SHARD_02_NAME || 'teachlink_shard_02',
      username: process.env.SHARD_02_USER || 'postgres',
      password: process.env.SHARD_02_PASSWORD || 'postgres',
      weight: 100,
      type: 'master',
      readOnly: false,
      status: 'active',
      maxConnections: parseInt(process.env.SHARD_02_POOL_MAX || '30', 10),
      minConnections: parseInt(process.env.SHARD_02_POOL_MIN || '5', 10),
      timeout: parseInt(process.env.SHARD_02_TIMEOUT || '5000', 10),
      retryAttempts: parseInt(process.env.SHARD_02_RETRY_ATTEMPTS || '3', 10),
    },
  };

  return {
    strategy: (process.env.SHARDING_STRATEGY as any) || 'key-based',
    keyField: process.env.SHARDING_KEY_FIELD || 'tenantId',
    shardKeyExtractor: process.env.SHARDING_KEY_EXTRACTOR || 'extractShardKey',
    hashAlgorithm: (process.env.SHARDING_HASH_ALGORITHM as any) || 'murmur3',
    virtualNodesPerShard: parseInt(process.env.SHARDING_VIRTUAL_NODES || '150', 10),
    defaultShard: process.env.SHARDING_DEFAULT_SHARD || 'shard_00',
    fallbackOnShardFailure: process.env.SHARDING_FALLBACK !== 'false',
    maxCrossShardRetries: parseInt(process.env.SHARDING_MAX_RETRIES || '2', 10),
    enableCache: process.env.SHARDING_CACHE_ENABLED !== 'false',
    cacheTtl: parseInt(process.env.SHARDING_CACHE_TTL || '300', 10),
    shards: baseShards,
    shardGroups: {
      primary: {
        id: 'primary',
        name: 'Primary Group',
        shards: Object.keys(baseShards),
        strategy: 'hash',
        replication: false,
        readFromReplicas: false,
        replicaReadStrategy: 'round-robin',
      },
    },
    shardMappings: {},
  };
});
