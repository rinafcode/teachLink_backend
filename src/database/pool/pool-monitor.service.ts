import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { resolvePoolConfig } from './pool.config';

/**
 * PoolMonitorService periodically samples the pg Pool driver statistics
 * and logs them. It exposes the current snapshot for health-check use.
 */
@Injectable()
export class PoolMonitorService implements OnModuleInit {
  private readonly logger = new Logger(PoolMonitorService.name);
  private readonly config = resolvePoolConfig();
  private intervalRef: NodeJS.Timeout | null = null;

  /** Snapshot updated on every sample tick. */
  snapshot = { total: 0, idle: 0, waiting: 0, utilizationPct: 0 };

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    // Sample every 30 s — lightweight, no extra DB round-trips.
    this.intervalRef = setInterval(() => this.sample(), 30_000);
    this.sample();
  }

  /** Read pool stats from the underlying pg Pool instance. */
  sample(): void {
    const pool = (this.dataSource.driver as any)?.master ?? (this.dataSource.driver as any);
    const pgPool = pool?.pool ?? pool?.master?.pool;

    if (!pgPool) return;

    const total: number = pgPool.totalCount ?? 0;
    const idle: number = pgPool.idleCount ?? 0;
    const waiting: number = pgPool.waitingCount ?? 0;
    const utilizationPct = this.config.max > 0 ? Math.round((total / this.config.max) * 100) : 0;

    this.snapshot = { total, idle, waiting, utilizationPct };

    this.logger.debug(
      `Pool stats — total: ${total}/${this.config.max}, idle: ${idle}, waiting: ${waiting}, utilization: ${utilizationPct}%`,
    );

    if (utilizationPct >= 90) {
      this.logger.warn(
        `Pool utilization critical: ${utilizationPct}% (${total}/${this.config.max})`,
      );
    }
  }

  getSnapshot() {
    return { ...this.snapshot, max: this.config.max, min: this.config.min };
  }

  onModuleDestroy(): void {
    if (this.intervalRef) clearInterval(this.intervalRef);
  }
}
