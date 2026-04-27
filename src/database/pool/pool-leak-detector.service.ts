import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { resolvePoolConfig } from './pool.config';

interface LeaseRecord {
  acquiredAt: number;
  stack: string;
}

/**
 * PoolLeakDetectorService wraps the pg Pool's `connect` event to track
 * every connection acquisition. Connections held longer than
 * DATABASE_POOL_LEAK_THRESHOLD_MS are logged as potential leaks.
 *
 * Detection runs on a periodic scan rather than per-query to keep overhead
 * minimal.
 */
@Injectable()
export class PoolLeakDetectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PoolLeakDetectorService.name);
  private readonly config = resolvePoolConfig();
  private readonly leases = new Map<object, LeaseRecord>();
  private intervalRef: NodeJS.Timeout | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    this.attachHooks();
    this.intervalRef = setInterval(() => this.scanLeaks(), 30_000);
  }

  private attachHooks(): void {
    const pool = (this.dataSource.driver as any)?.master ?? (this.dataSource.driver as any);
    const pgPool = pool?.pool ?? pool?.master?.pool;

    if (!pgPool) {
      this.logger.warn('Could not attach leak-detection hooks: pg Pool not accessible');
      return;
    }

    pgPool.on('connect', (client: object) => {
      this.leases.set(client, {
        acquiredAt: Date.now(),
        stack: new Error().stack ?? '',
      });
    });

    pgPool.on('remove', (client: object) => {
      this.leases.delete(client);
    });

    this.logger.log('Leak detection hooks attached to pg Pool');
  }

  private scanLeaks(): void {
    const now = Date.now();
    for (const [client, record] of this.leases) {
      const heldMs = now - record.acquiredAt;
      if (heldMs > this.config.leakThresholdMs) {
        this.logger.warn(
          `Potential connection leak detected — held for ${heldMs}ms ` +
            `(threshold: ${this.config.leakThresholdMs}ms)\n${record.stack}`,
        );
        // Remove from tracking to avoid repeated warnings for the same client.
        this.leases.delete(client);
      }
    }
  }

  /** Returns the count of currently tracked open connections. */
  getActiveLeaseCount(): number {
    return this.leases.size;
  }

  onModuleDestroy(): void {
    if (this.intervalRef) clearInterval(this.intervalRef);
    this.leases.clear();
  }
}
