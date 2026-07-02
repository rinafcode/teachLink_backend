import { Test, TestingModule } from '@nestjs/testing';
import { ShardRouter } from './router/shard-router.service';
import { ShardConfigService } from './shard-config.service';
import { ShardConfig, ShardStatus, ShardStrategy } from './interfaces/shard.interface';

const mockShards: ShardConfig[] = [
  {
    id: 'shard-00',
    name: 'Shard 0',
    host: 'pg-0.internal',
    port: 5432,
    username: 'user',
    password: 'pass',
    database: 'teachlink_0',
    poolMax: 30,
    poolMin: 5,
    weight: 100,
    status: ShardStatus.ACTIVE,
  },
  {
    id: 'shard-01',
    name: 'Shard 1',
    host: 'pg-1.internal',
    port: 5432,
    username: 'user',
    password: 'pass',
    database: 'teachlink_1',
    poolMax: 30,
    poolMin: 5,
    weight: 100,
    status: ShardStatus.ACTIVE,
  },
  {
    id: 'shard-02',
    name: 'Shard 2',
    host: 'pg-2.internal',
    port: 5432,
    username: 'user',
    password: 'pass',
    database: 'teachlink_2',
    poolMax: 30,
    poolMin: 5,
    weight: 50, // half weight → fewer virtual nodes
    status: ShardStatus.ACTIVE,
  },
];

const mockShardConfigService = {
  getActiveShards: jest.fn(() => mockShards),
  getShardById: jest.fn((id: string) => mockShards.find((s) => s.id === id)),
  reloadConfig: jest.fn(() => mockShards),
  onConfigUpdated: jest.fn((_listener: (message?: string) => void | Promise<void>) => jest.fn()),
};

describe('ShardRouter', () => {
  let router: ShardRouter;

  beforeEach(async () => {
    mockShardConfigService.getActiveShards.mockReturnValue(mockShards);
    mockShardConfigService.getShardById.mockImplementation((id: string) =>
      mockShards.find((s) => s.id === id),
    );
    mockShardConfigService.reloadConfig.mockReturnValue(mockShards);
    mockShardConfigService.onConfigUpdated.mockReturnValue(jest.fn());

    const module: TestingModule = await Test.createTestingModule({
      providers: [ShardRouter, { provide: ShardConfigService, useValue: mockShardConfigService }],
    }).compile();

    router = module.get<ShardRouter>(ShardRouter);
  });

  // ── Ring building ────────────────────────────────────────────────────────

  describe('rebuildRing', () => {
    it('builds a non-empty ring when active shards are available', () => {
      router.rebuildRing();
      // If the ring were empty, routing would throw
      expect(() => router.route('some-key')).not.toThrow();
    });

    it('produces a larger ring for higher-weight shards', () => {
      // White-box: access private routing snapshot via cast
      router.rebuildRing();
      const ring = (router as unknown as { routingSnapshot: { ring: { shardId: string }[] } })
        .routingSnapshot.ring;
      const shard00Count = ring.filter((n) => n.shardId === 'shard-00').length;
      const shard02Count = ring.filter((n) => n.shardId === 'shard-02').length;
      // shard-02 has weight=50, shard-00 has weight=100 → shard-00 should have ~2x nodes
      expect(shard00Count).toBeGreaterThan(shard02Count);
    });

    it('registers for shard config update events', () => {
      expect(mockShardConfigService.onConfigUpdated).toHaveBeenCalledTimes(1);
    });

    it('reloads when the shard config update listener fires', async () => {
      const expandedShards: ShardConfig[] = [
        ...mockShards,
        {
          id: 'shard-03',
          name: 'Shard 3',
          host: 'pg-3.internal',
          port: 5432,
          username: 'user',
          password: 'pass',
          database: 'teachlink_3',
          poolMax: 30,
          poolMin: 5,
          weight: 100,
          status: ShardStatus.ACTIVE,
        },
      ];

      mockShardConfigService.reloadConfig.mockReturnValue(expandedShards);
      mockShardConfigService.getActiveShards.mockReturnValue(expandedShards);
      mockShardConfigService.getShardById.mockImplementation((id: string) =>
        expandedShards.find((s) => s.id === id),
      );

      const updateListener = mockShardConfigService.onConfigUpdated.mock.calls[0][0] as (
        message?: string,
      ) => Promise<void>;
      await updateListener('test-config-version');

      const shardIds = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        shardIds.add(router.route(`pubsub-reload-user-${i}`).shard.id);
      }

      expect(shardIds).toContain('shard-03');
    });
  });

  // ── Hash-based routing ───────────────────────────────────────────────────

  describe('route (HASH_BASED)', () => {
    it('routes a key to a valid shard', () => {
      const result = router.route('user-12345');
      expect(['shard-00', 'shard-01', 'shard-02']).toContain(result.shard.id);
      expect(result.isReplica).toBe(false);
      expect(result.routingKey).toBe('user-12345');
    });

    it('is deterministic — same key always resolves to same shard', () => {
      const a = router.route('deterministic-key-abc');
      const b = router.route('deterministic-key-abc');
      expect(a.shard.id).toBe(b.shard.id);
    });

    it('distributes different keys across shards', () => {
      const shardIds = new Set<string>();
      for (let i = 0; i < 300; i++) {
        const result = router.route(`user-${i}`);
        shardIds.add(result.shard.id);
      }
      // With 300 keys and 3 shards, all shards should receive traffic
      expect(shardIds.size).toBe(3);
    });
  });

  // ── Tenant-based routing ─────────────────────────────────────────────────

  describe('route (TENANT_BASED)', () => {
    it('routes tenant:T1 the same regardless of entity sub-key', () => {
      const a = router.route('tenant:T1:course-1', ShardStrategy.TENANT_BASED);
      const b = router.route('tenant:T1:course-2', ShardStrategy.TENANT_BASED);
      const c = router.route('T1', ShardStrategy.TENANT_BASED);
      expect(a.shard.id).toBe(b.shard.id);
      expect(b.shard.id).toBe(c.shard.id);
    });
  });

  // ── Range-based routing ──────────────────────────────────────────────────

  describe('route (RANGE_BASED)', () => {
    beforeEach(() => {
      router.setRangeBuckets([
        { min: 0, max: 1_000_000, shardId: 'shard-00' },
        { min: 1_000_000, max: 2_000_000, shardId: 'shard-01' },
        { min: 2_000_000, max: 3_000_000, shardId: 'shard-02' },
      ]);
    });

    it('routes a numeric key within [0, 1M) to shard-00', () => {
      const result = router.route('500000', ShardStrategy.RANGE_BASED);
      expect(result.shard.id).toBe('shard-00');
    });

    it('routes a numeric key within [1M, 2M) to shard-01', () => {
      const result = router.route('1500000', ShardStrategy.RANGE_BASED);
      expect(result.shard.id).toBe('shard-01');
    });

    it('falls back to hash routing for non-numeric keys', () => {
      // Should not throw, falls back gracefully
      expect(() => router.route('not-a-number', ShardStrategy.RANGE_BASED)).not.toThrow();
    });
  });

  // ── Read replica routing ─────────────────────────────────────────────────

  describe('route with read replica', () => {
    it('returns isReplica=true when a replica is available and forRead=true', () => {
      const shardsWithReplica: ShardConfig[] = [
        {
          ...mockShards[0],
          readReplicas: [
            { id: 'shard-00-replica-0', host: 'pg-replica.internal', port: 5433, weight: 100 },
          ],
        },
        ...mockShards.slice(1),
      ];

      mockShardConfigService.getActiveShards.mockReturnValueOnce(shardsWithReplica);
      mockShardConfigService.getShardById.mockImplementation((id: string) =>
        shardsWithReplica.find((s) => s.id === id),
      );
      router.rebuildRing();

      // Find a key that maps to shard-00
      let replicaResult;
      for (let i = 0; i < 1000; i++) {
        const r = router.route(`key-${i}`, ShardStrategy.HASH_BASED, true);
        if (r.isReplica) {
          replicaResult = r;
          break;
        }
      }
      expect(replicaResult).toBeDefined();
      expect(replicaResult!.isReplica).toBe(true);
      expect(replicaResult!.shard.host).toBe('pg-replica.internal');
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('throws when no active shards exist', () => {
      mockShardConfigService.getActiveShards.mockReturnValueOnce([]);
      router.rebuildRing();
      expect(() => router.route('some-key')).toThrow('consistent-hash ring is empty');
    });
  });

  describe('live reload', () => {
    it('reloads shard config and routes using the new ring', async () => {
      const expandedShards: ShardConfig[] = [
        ...mockShards,
        {
          id: 'shard-03',
          name: 'Shard 3',
          host: 'pg-3.internal',
          port: 5432,
          username: 'user',
          password: 'pass',
          database: 'teachlink_3',
          poolMax: 30,
          poolMin: 5,
          weight: 100,
          status: ShardStatus.ACTIVE,
        },
      ];

      mockShardConfigService.reloadConfig.mockReturnValue(expandedShards);
      mockShardConfigService.getActiveShards.mockReturnValue(expandedShards);
      mockShardConfigService.getShardById.mockImplementation((id: string) =>
        expandedShards.find((s) => s.id === id),
      );

      await router.reloadConfig();

      const shardIds = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        shardIds.add(router.route(`reloaded-user-${i}`).shard.id);
      }

      expect(mockShardConfigService.reloadConfig).toHaveBeenCalled();
      expect(shardIds).toContain('shard-03');
    });

    it('does not route against a partially rebuilt ring during reload', async () => {
      let activeShards = mockShards;
      const expandedShards: ShardConfig[] = [
        ...mockShards,
        {
          id: 'shard-03',
          name: 'Shard 3',
          host: 'pg-3.internal',
          port: 5432,
          username: 'user',
          password: 'pass',
          database: 'teachlink_3',
          poolMax: 30,
          poolMin: 5,
          weight: 100,
          status: ShardStatus.ACTIVE,
        },
      ];

      mockShardConfigService.getActiveShards.mockImplementation(() => activeShards);
      mockShardConfigService.getShardById.mockImplementation((id: string) =>
        activeShards.find((s) => s.id === id),
      );
      mockShardConfigService.reloadConfig.mockImplementation(() => {
        activeShards = expandedShards;
        return activeShards;
      });

      const observedShardIds = new Set<string>();
      const routeErrors: Error[] = [];
      let keepRouting = true;

      const routingLoop = async () => {
        let i = 0;
        while (keepRouting) {
          try {
            observedShardIds.add(router.route(`live-reload-key-${i++}`).shard.id);
          } catch (error) {
            routeErrors.push(error as Error);
          }
          await Promise.resolve();
        }
      };

      const routingPromise = routingLoop();
      await Promise.resolve();
      await router.reloadConfig();

      for (let i = 0; i < 1000; i++) {
        observedShardIds.add(router.route(`post-reload-key-${i}`).shard.id);
      }

      keepRouting = false;
      await routingPromise;

      expect(routeErrors).toEqual([]);
      expect(observedShardIds).toContain('shard-03');
    });
  });
});
