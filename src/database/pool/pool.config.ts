/**
 * Centralised pool configuration resolved from environment variables.
 *
 * Env vars (all optional, defaults match README recommendations):
 *   DATABASE_POOL_MAX              – max connections (default 30)
 *   DATABASE_POOL_MIN              – min idle connections (default 5)
 *   DATABASE_POOL_ACQUIRE_TIMEOUT_MS – ms to wait for a free connection (default 10000)
 *   DATABASE_POOL_IDLE_TIMEOUT_MS  – ms before an idle connection is closed (default 30000)
 *   DATABASE_POOL_LEAK_THRESHOLD_MS – ms a connection may be held before flagged as leaked (default 60000)
 */
export interface PoolConfig {
  max: number;
  min: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  leakThresholdMs: number;
}

export function resolvePoolConfig(): PoolConfig {
  return {
    max: parseInt(process.env.DATABASE_POOL_MAX ?? '30', 10),
    min: parseInt(process.env.DATABASE_POOL_MIN ?? '5', 10),
    acquireTimeoutMs: parseInt(process.env.DATABASE_POOL_ACQUIRE_TIMEOUT_MS ?? '10000', 10),
    idleTimeoutMs: parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS ?? '30000', 10),
    leakThresholdMs: parseInt(process.env.DATABASE_POOL_LEAK_THRESHOLD_MS ?? '60000', 10),
  };
}
