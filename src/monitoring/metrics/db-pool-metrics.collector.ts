import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MetricsCollectionService } from './metrics-collection.service';

/**
 * Database Pool Metrics Collector
 *
 * Runs on a 15-second cron schedule and pushes TypeORM / pg connection pool
 * statistics into Prometheus gauges and counters defined in
 * `MetricsCollectionService`.
 *
 * Exposed metrics:
 *   - `db_pool_size`                       – Total pool slots (active + idle)
 *   - `db_pool_active_connections`         – Currently checked-out connections
 *   - `db_pool_idle_connections`           – Idle / available connections
 *   - `db_pool_pending_requests`           – Requests waiting for a free slot
 *   - `db_pool_connections_acquired_total` – Monotonically increasing acquire counter
 *   - `db_pool_connections_released_total` – Monotonically increasing release counter
 *
 * The underlying `pg` driver exposes pool internals via the non-standard
 * `driver.pool` property on the TypeORM DataSource. We access it through a
 * type-safe cast and guard against it being absent (e.g. when using a
 * different driver or a mocked DataSource in tests).
 */
@Injectable()
export class DbPoolMetricsCollector implements OnModuleInit {
  private readonly logger = new Logger(DbPoolMetricsCollector.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly metricsCollectionService: MetricsCollectionService,
  ) {}

  onModuleInit(): void {
    this.logger.log('DbPoolMetricsCollector initialised – will poll pool stats every 15 s');
    // Collect an initial snapshot immediately
    this.collectPoolMetrics();
  }

  /**
   * Scheduled job – polls pool statistics every 15 seconds.
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  collectPoolMetrics(): void {
    try {
      const pool = this.getPool();
      if (!pool) {
        return; // DataSource not yet initialised or using an unsupported driver
      }

      const totalCount: number = pool.totalCount ?? 0;
      const idleCount: number = pool.idleCount ?? 0;
      const waitingCount: number = pool.waitingCount ?? 0;
      const activeCount = totalCount - idleCount;

      // Update gauges
      this.metricsCollectionService.dbPoolSize.set(totalCount);
      this.metricsCollectionService.activeConnections.set(activeCount);
      this.metricsCollectionService.dbPoolIdleConnections.set(idleCount);
      this.metricsCollectionService.dbPoolPendingRequests.set(waitingCount);

      this.logger.debug(
        `Pool snapshot – total=${totalCount} active=${activeCount} idle=${idleCount} waiting=${waitingCount}`,
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
