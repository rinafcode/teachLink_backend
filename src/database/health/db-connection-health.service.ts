import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { resolvePoolConfig } from '../pool/pool.config';

export type DbHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface DbHealthResult {
  status: DbHealthStatus;
  latencyMs: number;
  pool: { total: number; idle: number; waiting: number; utilizationPct: number; max: number };
  recycledAt: string | null;
  checkedAt: string;
  message?: string;
}

@Injectable()
export class DbConnectionHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbConnectionHealthService.name);
  private readonly config = resolvePoolConfig();
  private intervalRef: NodeJS.Timeout | null = null;
  private lastRecycledAt: string | null = null;
  private lastResult: DbHealthResult | null = null;

  /** How often to run the background health check (ms). */
  private readonly CHECK_INTERVAL_MS = 30_000;
  /** Latency above this triggers a 'degraded' status. */
  private readonly LATENCY_WARN_MS = 200;
  /** Pool utilisation above this triggers a 'degraded' status. */
  private readonly UTIL_WARN_PCT = 80;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    this.intervalRef = setInterval(() => this.runCheck(), this.CHECK_INTERVAL_MS);
    this.runCheck();
  }

  onModuleDestroy(): void {
    if (this.intervalRef) clearInterval(this.intervalRef);
  }

  /** Run a lightweight health probe and return the result. */
  async check(): Promise<DbHealthResult> {
    return this.runCheck();
  }

  /** Return the cached result from the last background check. */
  getLastResult(): DbHealthResult | null {
    return this.lastResult;
  }

  private async runCheck(): Promise<DbHealthResult> {
    const checkedAt = new Date().toISOString();
    let latencyMs = 0;
    let status: DbHealthStatus = 'healthy';
    let message: string | undefined;

    try {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      latencyMs = Date.now() - start;
    } catch (err) {
      status = 'unhealthy';
      message = `DB ping failed: ${(err as Error).message}`;
      this.logger.error(`[DB HEALTH] ${message}`);
      const result: DbHealthResult = {
        status,
        latencyMs,
        pool: this.poolSnapshot(),
        recycledAt: this.lastRecycledAt,
        checkedAt,
        message,
      };
      this.lastResult = result;
      return result;
    }

    const pool = this.poolSnapshot();

    if (latencyMs > this.LATENCY_WARN_MS || pool.utilizationPct >= this.UTIL_WARN_PCT) {
      status = 'degraded';
      message =
        latencyMs > this.LATENCY_WARN_MS
          ? `High DB latency: ${latencyMs}ms`
          : `High pool utilisation: ${pool.utilizationPct}%`;
      this.logger.warn(`[DB HEALTH] ${message}`);
    }

    // Auto-recycle stale idle connections when pool is degraded
    if (status === 'degraded' && pool.idle > 0) {
      await this.recycleConnections();
    }

    const result: DbHealthResult = {
      status,
      latencyMs,
      pool,
      recycledAt: this.lastRecycledAt,
      checkedAt,
      message,
    };
    this.lastResult = result;
    return result;
  }

  private async recycleConnections(): Promise<void> {
    try {
      await this.dataSource.destroy();
      await this.dataSource.initialize();
      this.lastRecycledAt = new Date().toISOString();
      this.logger.log('[DB HEALTH] Connection pool recycled');
    } catch (err) {
      this.logger.error(`[DB HEALTH] Recycle failed: ${(err as Error).message}`);
    }
  }

  private poolSnapshot() {
    const driver = this.dataSource.driver as any;
    const pgPool = driver?.master?.pool ?? driver?.pool;
    const total: number = pgPool?.totalCount ?? 0;
    const idle: number = pgPool?.idleCount ?? 0;
    const waiting: number = pgPool?.waitingCount ?? 0;
    const utilizationPct = this.config.max > 0 ? Math.round((total / this.config.max) * 100) : 0;
    return { total, idle, waiting, utilizationPct, max: this.config.max };
  }
}
