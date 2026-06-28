import { resolvePoolConfig } from './pool.config';

describe('PoolConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should resolve config with default values', () => {
    // Clear any database pool environment variables
    delete process.env.DATABASE_POOL_MAX;
    delete process.env.DATABASE_POOL_MIN;
    delete process.env.DATABASE_POOL_ACQUIRE_TIMEOUT_MS;
    delete process.env.DATABASE_POOL_IDLE_TIMEOUT_MS;
    delete process.env.DATABASE_POOL_LEAK_THRESHOLD_MS;
    delete process.env.DATABASE_POOL_MAX_LIFETIME_SEC;
    delete process.env.DATABASE_POOL_QUERY_TIMEOUT_MS;
    delete process.env.DATABASE_POOL_SLOW_QUERY_THRESHOLD_MS;

    const config = resolvePoolConfig();

    expect(config.max).toBe(30);
    expect(config.min).toBe(5);
    expect(config.acquireTimeoutMs).toBe(10000);
    expect(config.idleTimeoutMs).toBe(30000);
    expect(config.leakThresholdMs).toBe(60000);
    expect(config.maxLifetimeSeconds).toBe(1800);
    expect(config.queryTimeoutMs).toBe(30000);
    expect(config.slowQueryThresholdMs).toBe(1000);
  });

  it('should resolve config with custom environment values', () => {
    process.env.DATABASE_POOL_MAX = '50';
    process.env.DATABASE_POOL_MIN = '10';
    process.env.DATABASE_POOL_ACQUIRE_TIMEOUT_MS = '5000';
    process.env.DATABASE_POOL_IDLE_TIMEOUT_MS = '15000';
    process.env.DATABASE_POOL_LEAK_THRESHOLD_MS = '30000';
    process.env.DATABASE_POOL_MAX_LIFETIME_SEC = '900';
    process.env.DATABASE_POOL_QUERY_TIMEOUT_MS = '20000';
    process.env.DATABASE_POOL_SLOW_QUERY_THRESHOLD_MS = '500';

    const config = resolvePoolConfig();

    expect(config.max).toBe(50);
    expect(config.min).toBe(10);
    expect(config.acquireTimeoutMs).toBe(5000);
    expect(config.idleTimeoutMs).toBe(15000);
    expect(config.leakThresholdMs).toBe(30000);
    expect(config.maxLifetimeSeconds).toBe(900);
    expect(config.queryTimeoutMs).toBe(20000);
    expect(config.slowQueryThresholdMs).toBe(500);
  });
});
