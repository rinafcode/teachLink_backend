import { Test } from '@nestjs/testing';
import { ShardRouter } from './sharding/router/shard.router';
import { ShardHash } from './sharding/hash/shard.hash';
import { ShardDataSourceManager } from './sharding/datasource/shard-datasource.manager';
import { CrossShardQueryCoordinator } from './sharding/coordinator/cross-shard-query-coordinator';
import { ShardTransactionService } from './sharding/shard-transaction.service';
import { ShardAwareRepository } from './sharding/repository/shard-aware-repository';
import { ShardConfig, ShardingConfig } from './sharding/config/shard.config';

describe('ShardHash', () => {
  let shardHash: ShardHash;

  beforeEach(() => {
    const shards = ['shard_00', 'shard_01', 'shard_02'];
    const weights = new Map<string, number>([
      ['shard_00', 100],
      ['shard_01', 100],
      ['shard_02', 100],
    ]);
    shardHash = new ShardHash(shards, weights, 150);
  });

  it('should be defined', () => {
    expect(shardHash).toBeDefined();
  });

  it('should route key to same shard consistently', () => {
    const key = 'test_key_123';
    const shard1 = shardHash.getShard(key);
    const shard2 = shardHash.getShard(key);
    expect(shard1).toBe(shard2);
  });

  it('should distribute keys across shards', () => {
    const distribution = new Map<string, number>();
    const testKeys = 1000;

    for (let i = 0; i < testKeys; i++) {
      const key = `key_${i}`;
      const shard = shardHash.getShard(key);
      distribution.set(shard, (distribution.get(shard) || 0) + 1);
    }

    expect(distribution.size).toBeGreaterThan(1);
    const average = testKeys / distribution.size;
    for (const count of distribution.values()) {
      expect(count).toBeGreaterThan(average * 0.5);
      expect(count).toBeLessThan(average * 1.5);
    }
  });

  it('should get all shards', () => {
    const shards = shardHash.getAllShards();
    expect(shards).toContain('shard_00');
    expect(shards).toContain('shard_01');
    expect(shards).toContain('shard_02');
  });

  it('should get replica shards', () => {
    const replicas = shardHash.getShards('test_key', 2);
    expect(replicas.length).toBeLessThanOrEqual(2);
    expect(replicas.length).toBeGreaterThan(0);
  });
});

describe('ShardRouter', () => {
  let shardRouter: ShardRouter;
  const mockConfig = {
    strategy: 'key-based' as const,
    keyField: 'tenantId',
    shardKeyExtractor: 'extractShardKey',
    hashAlgorithm: 'murmur3' as const,
    virtualNodesPerShard: 150,
    defaultShard: 'shard_00',
    fallbackOnShardFailure: true,
    maxCrossShardRetries: 2,
    enableCache: false,
    cacheTtl: 300,
    shards: {
      shard_00: {
        id: 'shard_00',
        name: 'Primary Shard',
        host: 'localhost',
        port: 5432,
        database: 'teachlink_shard_00',
        username: 'postgres',
        password: 'postgres',
        weight: 100,
        type: 'master' as const,
        readOnly: false,
        status: 'active' as const,
        maxConnections: 30,
        minConnections: 5,
        timeout: 5000,
        retryAttempts: 3,
      },
      shard_01: {
        id: 'shard_01',
        name: 'Shard 1',
        host: 'localhost',
        port: 5433,
        database: 'teachlink_shard_01',
        username: 'postgres',
        password: 'postgres',
        weight: 100,
        type: 'master' as const,
        readOnly: false,
        status: 'active' as const,
        maxConnections: 30,
        minConnections: 5,
        timeout: 5000,
        retryAttempts: 3,
      },
    },
    shardGroups: {
      primary: {
        id: 'primary',
        name: 'Primary Group',
        shards: ['shard_00', 'shard_01'],
        strategy: 'hash' as const,
        replication: false,
        readFromReplicas: false,
        replicaReadStrategy: 'round-robin' as const,
      },
    },
    shardMappings: {},
  } as ShardingConfig;

  beforeEach(() => {
    shardRouter = new ShardRouter(mockConfig);
  });

  it('should be defined', () => {
    expect(shardRouter).toBeDefined();
  });

  it('should route key to shard', () => {
    const shardId = shardRouter.route('test_key');
    expect(shardId).toBeDefined();
    expect(['shard_00', 'shard_01']).toContain(shardId);
  });

  it('should route key consistently', () => {
    const key = 'consistent_key';
    const shard1 = shardRouter.route(key);
    const shard2 = shardRouter.route(key);
    expect(shard1).toBe(shard2);
  });

  it('should get active shards', () => {
    const activeShards = shardRouter.getActiveShards();
    expect(activeShards.length).toBeGreaterThan(0);
  });

  it('should check shard status', () => {
    expect(shardRouter.isShardActive('shard_00')).toBe(true);
    expect(shardRouter.isShardActive('nonexistent')).toBe(false);
  });

  it('should add and remove mapping', () => {
    shardRouter.addMapping('custom_key', 'shard_00');
    const shardId = shardRouter.route('custom_key');
    expect(shardId).toBe('shard_00');
  });

  it('should get shard config', () => {
    const config = shardRouter.getShardConfig('shard_00');
    expect(config).toBeDefined();
    expect(config?.id).toBe('shard_00');
  });
});

describe('ShardAwareRepository', () => {
  let repository: TestShardRepository;
  let mockShardRouter: any;
  let mockDataSourceManager: any;
  let mockQueryCoordinator: any;

  class TestShardRepository extends ShardAwareRepository<any> {
    constructor() {
      super(mockShardRouter, mockDataSourceManager, mockQueryCoordinator, 'test_table');
    }
  }

  beforeEach(() => {
    mockShardRouter = {
      route: jest.fn().mockReturnValue('shard_00'),
      getActiveShards: jest.fn().mockReturnValue(['shard_00', 'shard_01']),
      getAllShards: jest.fn().mockReturnValue(['shard_00', 'shard_01']),
      isShardActive: jest.fn().mockReturnValue(true),
    } as any;

    mockDataSourceManager = {
      query: jest.fn().mockResolvedValue([]),
      runOnShard: jest.fn().mockImplementation(async (shardId: string, fn: any) => fn({})),
      getDataSource: jest.fn(),
      getManager: jest.fn(),
      createQueryRunner: jest.fn(),
      getActiveShardIds: jest.fn().mockReturnValue(['shard_00', 'shard_01']),
      isShardAvailable: jest.fn().mockReturnValue(true),
      getShardHealth: jest.fn().mockResolvedValue({ available: true }),
      destroy: jest.fn(),
    } as any;

    mockQueryCoordinator = {
      executeCrossShardQuery: jest.fn().mockResolvedValue([]),
      executeCrossShardAggregation: jest.fn().mockResolvedValue({}),
      executeCrossShardTransaction: jest.fn().mockResolvedValue({ success: true }),
      getDistribution: jest.fn(),
      getClusterHealth: jest.fn(),
    } as any;

    repository = new TestShardRepository();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  it('should find one by shard key', async () => {
    const mockResult = { id: '1', name: 'Test' };
    (mockDataSourceManager.query as jest.Mock).mockResolvedValue([mockResult]);

    const result = await repository.findOneByShardKey('test_key');
    expect(result).toEqual(mockResult);
  });

  it('should insert on shard', async () => {
    const mockResult = { id: '1', name: 'Test' };
    (mockDataSourceManager.query as jest.Mock).mockResolvedValue([mockResult]);

    const result = await repository.insertOnShard('tenant_1', { name: 'Test' });
    expect(result).toEqual(mockResult);
  });
});
