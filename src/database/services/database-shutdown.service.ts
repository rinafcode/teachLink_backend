import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PoolMonitorService } from '../pool/pool-monitor.service';

export interface DatabaseShutdownOptions {
  drainTimeoutMs: number;
  forceCloseTimeoutMs: number;
  waitForActiveQueries: boolean;
  logConnectionDetails: boolean;
}

/**
 * Manages graceful shutdown of database connections and pools
 */
@Injectable()
export class DatabaseShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseShutdownService.name);
  private isShuttingDown = false;

  private readonly options: DatabaseShutdownOptions = {
    drainTimeoutMs: parseInt(process.env.DB_DRAIN_TIMEOUT_MS || '15000', 10),
    forceCloseTimeoutMs: parseInt(process.env.DB_FORCE_CLOSE_TIMEOUT_MS || '5000', 10),
    waitForActiveQueries: process.env.DB_WAIT_FOR_QUERIES !== 'false',
    logConnectionDetails: process.env.DB_LOG_SHUTDOWN_DETAILS === 'true',
  };

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly poolMonitor: PoolMonitorService,
  ) {}

  /**
   * Gracefully shutdown database connections
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Database shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.logger.log('Starting database graceful shutdown...');

    try {
      // Log current pool status
      await this.logPoolStatus('before shutdown');

      // Phase 1: Stop accepting new connections and drain existing ones
      await this.drainConnections();

      // Phase 2: Wait for active queries to complete
      if (this.options.waitForActiveQueries) {
        await this.waitForActiveQueries();
      }

      // Phase 3: Close all connections
      await this.closeConnections();

      this.logger.log('Database shutdown completed successfully');
    } catch (error) {
      this.logger.error('Error during database shutdown:', error);
      throw error;
    }
  }

  /**
   * Drain existing connections gracefully
   */
  private async drainConnections(): Promise<void> {
    this.logger.log('Draining database connections...');
    const startTime = Date.now();

    try {
      // Get the underlying connection pool
      const pool = this.getConnectionPool();

      if (!pool) {
        this.logger.warn('No connection pool found, skipping drain phase');
        return;
      }

      // Wait for connections to be returned to the pool or timeout
      await this.waitForConnectionDrain(pool);

      const duration = Date.now() - startTime;
      this.logger.log(`Connection drain completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Connection drain failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Wait for active database queries to complete
   */
  private async waitForActiveQueries(): Promise<void> {
    this.logger.log('Waiting for active database queries to complete...');
    const startTime = Date.now();
    const checkInterval = 500; // Check every 500ms

    return new Promise((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        const duration = Date.now() - startTime;
        this.logger.warn(`Timeout waiting for active queries after ${duration}ms`);
        reject(new Error('Timeout waiting for active database queries'));
      }, this.options.drainTimeoutMs);

      const checkQueries = async () => {
        try {
          const activeQueries = await this.getActiveQueryCount();

          if (activeQueries === 0) {
            clearTimeout(timeoutTimer);
            const duration = Date.now() - startTime;
            this.logger.log(`All database queries completed after ${duration}ms`);
            resolve();
          } else {
            this.logger.debug(`Waiting for ${activeQueries} active queries...`);
            setTimeout(checkQueries, checkInterval);
          }
        } catch (error) {
          clearTimeout(timeoutTimer);
          this.logger.error('Error checking active queries:', error);
          // Continue with shutdown even if we can't check query status
          resolve();
        }
      };

      checkQueries();
    });
  }

  /**
   * Close all database connections
   */
  private async closeConnections(): Promise<void> {
    this.logger.log('Closing database connections...');
    const startTime = Date.now();

    try {
      // Close the main data source
      if (this.dataSource.isInitialized) {
        await Promise.race([
          this.dataSource.destroy(),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Database close timeout'));
            }, this.options.forceCloseTimeoutMs);
          }),
        ]);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Database connections closed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Error closing database connections after ${duration}ms:`, error);

      // Force close if graceful close fails
      try {
        await this.forceCloseConnections();
      } catch (forceError) {
        this.logger.error('Force close also failed:', forceError);
        throw forceError;
      }
    }
  }

  /**
   * Force close database connections (emergency fallback)
   */
  private async forceCloseConnections(): Promise<void> {
    this.logger.warn('Force closing database connections...');

    try {
      const pool = this.getConnectionPool();
      if (pool && typeof pool.end === 'function') {
        await pool.end();
      }

      this.logger.log('Force close completed');
    } catch (error) {
      this.logger.error('Force close failed:', error);
      throw error;
    }
  }

  /**
   * Get the underlying connection pool
   */
  private getConnectionPool(): any {
    try {
      const driver = this.dataSource.driver as any;
      return driver?.master?.pool || driver?.pool;
    } catch (error) {
      this.logger.debug('Could not access connection pool:', error);
      return null;
    }
  }

  /**
   * Wait for connections to be drained from the pool
   */
  private async waitForConnectionDrain(pool: any): Promise<void> {
    const checkInterval = 200; // Check every 200ms
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        const duration = Date.now() - startTime;
        reject(new Error(`Connection drain timeout after ${duration}ms`));
      }, this.options.drainTimeoutMs);

      const checkDrain = () => {
        try {
          const totalConnections = pool.totalCount || 0;
          const idleConnections = pool.idleCount || 0;
          const waitingClients = pool.waitingCount || 0;

          // Consider drained when all connections are idle and no clients waiting
          if (totalConnections === idleConnections && waitingClients === 0) {
            clearTimeout(timeoutTimer);
            resolve();
          } else {
            this.logger.debug(
              `Draining: ${totalConnections} total, ${idleConnections} idle, ${waitingClients} waiting`,
            );
            setTimeout(checkDrain, checkInterval);
          }
        } catch (error) {
          clearTimeout(timeoutTimer);
          this.logger.debug('Error checking pool status during drain:', error);
          // Continue anyway
          resolve();
        }
      };

      checkDrain();
    });
  }

  /**
   * Get count of active database queries
   */
  private async getActiveQueryCount(): Promise<number> {
    try {
      // Query PostgreSQL to get active connection count
      const result = await this.dataSource.query(`
        SELECT COUNT(*) as active_count 
        FROM pg_stat_activity 
        WHERE state = 'active' 
        AND datname = current_database()
        AND pid != pg_backend_pid()
      `);

      return parseInt(result[0]?.active_count || '0', 10);
    } catch (error) {
      this.logger.debug('Could not query active connections:', error);
      return 0; // Assume no active queries if we can't check
    }
  }

  /**
   * Log current pool status for debugging
   */
  private async logPoolStatus(phase: string): Promise<void> {
    if (!this.options.logConnectionDetails) {
      return;
    }

    try {
      const snapshot = this.poolMonitor.snapshot;
      const activeQueries = await this.getActiveQueryCount();

      this.logger.log(
        `Pool status ${phase}: total=${snapshot.total}, idle=${snapshot.idle}, ` +
          `waiting=${snapshot.waiting}, utilization=${snapshot.utilizationPct}%, ` +
          `active_queries=${activeQueries}`,
      );
    } catch (error) {
      this.logger.debug(`Could not log pool status ${phase}:`, error);
    }
  }

  /**
   * Get database shutdown status
   */
  getShutdownStatus(): {
    isShuttingDown: boolean;
    options: DatabaseShutdownOptions;
    poolSnapshot: any;
  } {
    return {
      isShuttingDown: this.isShuttingDown,
      options: this.options,
      poolSnapshot: this.poolMonitor.snapshot,
    };
  }

  /**
   * NestJS lifecycle hook
   */
  async onModuleDestroy(): Promise<void> {
    if (!this.isShuttingDown) {
      await this.shutdown();
    }
  }
}
