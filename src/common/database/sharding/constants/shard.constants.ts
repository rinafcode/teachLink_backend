/**
 * Shard Constants
 */

export const SHARD_KEY = 'shardKey';
export const SHARD_GROUP = 'shardGroup';
export const SHARD_STRATEGY = {
  HASH: 'hash',
  RANGE: 'range',
  LIST: 'list',
  COMPOSITE: 'composite',
} as const;

export const SHARDING_STRATEGIES = {
  KEY_BASED: 'key-based',
  RANGE_BASED: 'range-based',
  DIRECTORY_BASED: 'directory-based',
} as const;

export const AGGREGATION_STRATEGIES = {
  MERGE: 'merge',
  UNION: 'union',
  AGGREGATE: 'aggregate',
  FIRST: 'first',
} as const;

export const SHARD_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance',
} as const;

export const SHARD_TYPES = {
  MASTER: 'master',
  SLAVE: 'slave',
} as const;
