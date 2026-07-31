/**
 * Issue #837 — Redis Sentinel/Cluster connection factory.
 *
 * Exercises `getRedisDeploymentMode`/`getSharedRedisClient` against
 * `ioredis-mock` so the topology-selection logic (standalone vs Sentinel vs
 * Cluster) and basic command execution can be verified without a real
 * Redis/Sentinel/Cluster deployment.
 */
jest.mock('ioredis', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ActualMock = jest.requireActual('ioredis-mock');

  const ctorSpy = jest.fn((...args: unknown[]) => new ActualMock(...args));
  const clusterCtorSpy = jest.fn((...args: unknown[]) => new ActualMock.Cluster(...args));
  (ctorSpy as unknown as { Cluster: unknown }).Cluster = clusterCtorSpy;

  return { __esModule: true, default: ctorSpy };
});

import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import {
  getRedisDeploymentMode,
  getSharedRedisClient,
  resetSharedRedisClientForTests,
} from './cache.config';

function buildConfigService(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

const redisCtorSpy = Redis as unknown as jest.Mock;
const clusterCtorSpy = (Redis as unknown as { Cluster: jest.Mock }).Cluster;

describe('getRedisDeploymentMode', () => {
  it('defaults to standalone when neither cluster nor sentinel vars are set', () => {
    expect(getRedisDeploymentMode(buildConfigService({}))).toBe('standalone');
  });

  it('resolves sentinel mode when REDIS_SENTINEL_HOSTS is set', () => {
    const config = buildConfigService({
      REDIS_SENTINEL_HOSTS: 'sentinel1:26379,sentinel2:26379',
    });
    expect(getRedisDeploymentMode(config)).toBe('sentinel');
  });

  it('resolves cluster mode when REDIS_CLUSTER_NODES is set', () => {
    const config = buildConfigService({ REDIS_CLUSTER_NODES: 'node1:7000,node2:7001' });
    expect(getRedisDeploymentMode(config)).toBe('cluster');
  });

  it('prefers cluster over sentinel when both are configured', () => {
    const config = buildConfigService({
      REDIS_CLUSTER_NODES: 'node1:7000',
      REDIS_SENTINEL_HOSTS: 'sentinel1:26379',
    });
    expect(getRedisDeploymentMode(config)).toBe('cluster');
  });
});

describe('getSharedRedisClient', () => {
  afterEach(() => {
    resetSharedRedisClientForTests();
    redisCtorSpy.mockClear();
    clusterCtorSpy.mockClear();
  });

  it('builds a standalone client from REDIS_HOST/REDIS_PORT and executes commands', async () => {
    const config = buildConfigService({ REDIS_HOST: 'localhost', REDIS_PORT: '6379' });

    const client = getSharedRedisClient(config);

    expect(redisCtorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'localhost', port: 6379 }),
    );
    expect(clusterCtorSpy).not.toHaveBeenCalled();

    await client.set('standalone-key', 'standalone-value');
    await expect(client.get('standalone-key')).resolves.toBe('standalone-value');
  });

  it('builds a Sentinel-backed client from REDIS_SENTINEL_HOSTS / REDIS_SENTINEL_NAME', async () => {
    const config = buildConfigService({
      REDIS_SENTINEL_HOSTS: 'sentinel1:26379,sentinel2:26379,sentinel3:26379',
      REDIS_SENTINEL_NAME: 'mymaster',
      REDIS_SENTINEL_PASSWORD: 'sentinel-secret',
    });

    const client = getSharedRedisClient(config);

    expect(clusterCtorSpy).not.toHaveBeenCalled();
    expect(redisCtorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'mymaster',
        sentinelPassword: 'sentinel-secret',
        sentinels: [
          { host: 'sentinel1', port: 26379 },
          { host: 'sentinel2', port: 26379 },
          { host: 'sentinel3', port: 26379 },
        ],
      }),
    );

    // Failover to a promoted replica is handled internally by ioredis via
    // the sentinel connector — from the application's perspective the
    // client keeps serving the same command interface.
    await client.set('sentinel-key', 'sentinel-value');
    await expect(client.get('sentinel-key')).resolves.toBe('sentinel-value');
  });

  it('defaults REDIS_SENTINEL_NAME to "mymaster" when unset', () => {
    const config = buildConfigService({ REDIS_SENTINEL_HOSTS: 'sentinel1:26379' });

    getSharedRedisClient(config);

    expect(redisCtorSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'mymaster' }));
  });

  it('builds a Cluster client from REDIS_CLUSTER_NODES and executes commands', async () => {
    const config = buildConfigService({
      REDIS_CLUSTER_NODES: 'node1:7000,node2:7001,node3:7002',
    });

    const client = getSharedRedisClient(config);

    expect(clusterCtorSpy).toHaveBeenCalledWith(
      [
        { host: 'node1', port: 7000 },
        { host: 'node2', port: 7001 },
        { host: 'node3', port: 7002 },
      ],
      expect.objectContaining({ enableReadyCheck: true }),
    );
    expect(redisCtorSpy).not.toHaveBeenCalled();

    await client.set('cluster-key', 'cluster-value');
    await expect(client.get('cluster-key')).resolves.toBe('cluster-value');
  });

  it('reuses the same singleton client across calls until reset', () => {
    const config = buildConfigService({});

    const first = getSharedRedisClient(config);
    const second = getSharedRedisClient(config);

    expect(first).toBe(second);
    expect(redisCtorSpy).toHaveBeenCalledTimes(1);
  });

  it('builds a fresh client after resetSharedRedisClientForTests', () => {
    const config = buildConfigService({});

    const first = getSharedRedisClient(config);
    resetSharedRedisClientForTests();
    const second = getSharedRedisClient(config);

    expect(first).not.toBe(second);
    expect(redisCtorSpy).toHaveBeenCalledTimes(2);
  });
});
