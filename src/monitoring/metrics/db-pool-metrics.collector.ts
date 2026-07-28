import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MetricsCollectionService } from './metrics-collection.service';
import { resolvePoolConfig } from '../../database/pool';

/**
 * Database Pool Metrics Collector
 *
 * Polls the TypeORM / pg connection pool every 15 seconds and pushes
 * statistics into Prometheus gauges defined in `MetricsCollectionService`.
 *
 * Exposed metrics (per spec for issue #883):
 *   - `db_pool_active_connections` – Currently checked-out connections
 *   - `db_pool_idle_connections`   – Idle / available connections
 *   - `db_pool_waiting_requests`   – Requests waiting for a free slot
 *   - `db_pool_max_connections`    – Configured maximum pool capacity
 *   - `db_pool_utilization`        – Ratio active/max in [0, 1] (for alerting)
 *
 * The underlying `pg` driver exposes pool internals via the non-standard
 * `driver.pool` property on the TypeORM DataSource. We access it through a
 * type-safe cast and guard against it being absent (e.g. when using a
 * different driver or a mocked DataSource in tests).
 */
@Injectable()
export class DbPoolMetricsCollector implements OnModuleInit {
  private readonly logger = new Logger(DbPoolMetricsCollector.name);
  private readonly config = resolvePoolConfig();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly metricsCollectionService: MetricsCollectionService,
  ) {}

  onModuleInit(): void {
    this.logger.log('DbPoolMetricsCollector initialised – will poll pool stats every 15 s');
    // Collect an initial snapshot immediately
    this.collectPoolMetrics();
    this.setupPoolEventListeners();
  }

  private setupPoolEventListeners(): void {
    const pool = this.getPool();
    if (!pool) {
      this.logger.warn('Could not attach pool event listeners: pg Pool not accessible');
      return;
    }

    const pgPool = pool as any;

    pgPool.on('connect', (client: any) => {
      client.createdAt = Date.now();
      client.lastReleasedAt = Date.now();
    });

    pgPool.on('acquire', () => {
      this.metricsCollectionService.dbPoolConnectionsAcquired.inc();
    });

    pgPool.on('release', (err: any, client: any) => {
      this.metricsCollectionService.dbPoolConnectionsReleased.inc();
      if (client) {
        client.lastReleasedAt = Date.now();
      }
    });

    pgPool.on('remove', (client: any) => {
      if (!client) return;
      const now = Date.now();
      const age = client.createdAt ? now - client.createdAt : 0;
      const idleDuration = client.lastReleasedAt ? now - client.lastReleasedAt : 0;

      const maxLifetimeMs = this.config.maxLifetimeSeconds * 1000;
      const idleTimeoutMs = this.config.idleTimeoutMs;

      if (maxLifetimeMs > 0 && age >= maxLifetimeMs - 500) {
        this.metricsCollectionService.dbPoolMaxLifetimeClosed.inc();
        this.logger.debug(`Connection closed due to max lifetime: age=${age}ms`);
      } else if (idleTimeoutMs > 0 && idleDuration >= idleTimeoutMs - 500) {
        this.metricsCollectionService.dbPoolMaxIdleClosed.inc();
        this.logger.debug(`Connection closed due to idle timeout: idleDuration=${idleDuration}ms`);
      }
    });

    const originalConnect = pgPool.connect;
    if (typeof originalConnect === 'function') {
      pgPool.connect = (...args: any[]) => {
        const start = process.hrtime.bigint();
        const wasWaiting = (pgPool.waitingCount ?? 0) > 0 || (pgPool.idleCount ?? 0) === 0;

        if (wasWaiting) {
          this.metricsCollectionService.dbPoolWaitCount.inc();
        }

        if (args.length > 0 && typeof args[0] === 'function') {
          const cb = args[0];
          return originalConnect.call(pgPool, (err: any, client: any, release: any) => {
            const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
            this.metricsCollectionService.dbPoolWaitDuration.observe(durationSeconds);
            cb(err, client, release);
          });
        } else {
          return originalConnect.apply(pgPool, args).then(
            (client: any) => {
              const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
              this.metricsCollectionService.dbPoolWaitDuration.observe(durationSeconds);
              return client;
            },
            (err: any) => {
              const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
              this.metricsCollectionService.dbPoolWaitDuration.observe(durationSeconds);
              throw err;
            },
          );
        }
      };
    }
  }

  /**
   * Scheduled job – polls pool statistics every 15 seconds.
   */
  @Cron('*/15 * * * * *')
  collectPoolMetrics(): void {
    try {
      const pool = this.getPool();
      if (!pool) {
        // Even when pool is unavailable, expose the configured max so dashboards
        // do not show a stale or missing value.
        this.metricsCollectionService.dbPoolMaxConnections.set(this.config.max);
        return;
      }

      const totalCount: number = pool.totalCount ?? 0;
      const idleCount: number = pool.idleCount ?? 0;
      const waitingCount: number = pool.waitingCount ?? 0;
      const activeCount = totalCount - idleCount;
      const max = this.config.max;
      const utilization = max > 0 ? activeCount / max : 0;

      // Update gauges
      this.metricsCollectionService.dbPoolSize.set(totalCount);
      this.metricsCollectionService.dbPoolActiveConnections.set(activeCount);
      this.metricsCollectionService.dbPoolIdleConnections.set(idleCount);
      this.metricsCollectionService.dbPoolWaitingRequests.set(waitingCount);
      this.metricsCollectionService.dbPoolMaxConnections.set(max);
      this.metricsCollectionService.dbPoolUtilization.set(utilization);

      this.logger.debug(
        `Pool snapshot – total=${totalCount} active=${activeCount} idle=${idleCount} waiting=${waitingCount} util=${(utilization * 100).toFixed(1)}%`,
      );
    } catch (err) {
      this.logger.warn(
        `Pool metric collection failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Retrieves the underlying `pg` Pool instance from the TypeORM DataSource.
   *
   * TypeORM exposes the pool via `dataSource.driver.pool` for the `postgres`
   * driver.  We access it through an intentional `unknown` cast to avoid
   * importing internal TypeORM types.
   */
  private getPool(): PgPoolLike | null {
    if (!this.dataSource.isInitialized) {
      return null;
    }

    try {
      const driver = (this.dataSource as unknown as { driver: { pool?: PgPoolLike } }).driver;
      return driver?.pool ?? null;
    } catch {
      return null;
    }
  }
}

/**
 * Minimal shape of the `pg` Pool object that we inspect.
 * We only declare what we actually read so this stays compatible with any
 * pg-pool version.
 */
interface PgPoolLike {
  totalCount?: number;
  idleCount?: number;
  waitingCount?: number;
}
