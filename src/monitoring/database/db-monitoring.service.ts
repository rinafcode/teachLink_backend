import { Injectable, Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface DatabaseMetrics {
  connections: {
    active: number;
    idle: number;
    total: number;
    maxConnections: number;
  };
  queries: {
    totalQueries: number;
    slowQueries: number;
    avgQueryTime: number;
    queriesPerSecond: number;
  };
  locks: {
    totalLocks: number;
    waitingLocks: number;
    deadlocks: number;
  };
  cache: {
    hitRatio: number;
    bufferHitRatio: number;
  };
  storage: {
    databaseSize: number;
    indexSize: number;
    tableCount: number;
  };
  replication: {
    isReplica: boolean;
    replicationLag?: number;
    replicationStatus?: string;
  };
}

export interface SlowQuery {
  query: string;
  avgTime: number;
  totalTime: number;
  calls: number;
  rows: number;
  hitRatio: number;
  lastSeen: Date;
}

@Injectable()
export class DatabaseMonitoringService {
  private readonly logger = new Logger(DatabaseMonitoringService.name);
  private metricsHistory: DatabaseMetrics[] = [];

  constructor(private readonly dataSource: DataSource) {}

  async collectDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      const [connections, queries, locks, cache, storage, replication] =
        await Promise.all([
          this.getConnectionMetrics(),
          this.getQueryMetrics(),
          this.getLockMetrics(),
          this.getCacheMetrics(),
          this.getStorageMetrics(),
          this.getReplicationMetrics(),
        ]);

      const metrics: DatabaseMetrics = {
        connections,
        queries,
        locks,
        cache,
        storage,
        replication,
      };

      this.metricsHistory.push(metrics);

      // Keep only last 1000 metrics
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory = this.metricsHistory.slice(-1000);
      }

      return metrics;
    } catch (error) {
      this.logger.error('Failed to collect database metrics', error);
      throw error;
    }
  }

  private async getConnectionMetrics() {
    try {
      const result = await this.dataSource.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      const maxConnections = await this.dataSource.query(`
        SELECT setting::int as max_connections 
        FROM pg_settings 
        WHERE name = 'max_connections'
      `);

      return {
        active: Number.parseInt(result[0]?.active_connections || '0'),
        idle: Number.parseInt(result[0]?.idle_connections || '0'),
        total: Number.parseInt(result[0]?.total_connections || '0'),
        maxConnections: Number.parseInt(
          maxConnections[0]?.max_connections || '100',
        ),
      };
    } catch (error) {
      this.logger.error('Failed to get connection metrics', error);
      return { active: 0, idle: 0, total: 0, maxConnections: 100 };
    }
  }

  private async getQueryMetrics() {
    try {
      const statsResult = await this.dataSource.query(`
        SELECT 
          sum(calls) as total_queries,
          avg(mean_exec_time) as avg_query_time,
          sum(calls) FILTER (WHERE mean_exec_time > 1000) as slow_queries
        FROM pg_stat_statements
      `);

      const activityResult = await this.dataSource.query(`
        SELECT count(*) as current_queries
        FROM pg_stat_activity
        WHERE state = 'active' AND query != '<IDLE>'
      `);

      return {
        totalQueries: Number.parseInt(statsResult[0]?.total_queries || '0'),
        slowQueries: Number.parseInt(statsResult[0]?.slow_queries || '0'),
        avgQueryTime: Number.parseFloat(statsResult[0]?.avg_query_time || '0'),
        queriesPerSecond: Number.parseInt(
          activityResult[0]?.current_queries || '0',
        ),
      };
    } catch (error) {
      this.logger.error('Failed to get query metrics', error);
      return {
        totalQueries: 0,
        slowQueries: 0,
        avgQueryTime: 0,
        queriesPerSecond: 0,
      };
    }
  }

  private async getLockMetrics() {
    try {
      const result = await this.dataSource.query(`
        SELECT 
          count(*) as total_locks,
          count(*) FILTER (WHERE NOT granted) as waiting_locks
        FROM pg_locks
      `);

      const deadlocks = await this.dataSource.query(`
        SELECT deadlocks
        FROM pg_stat_database
        WHERE datname = current_database()
      `);

      return {
        totalLocks: Number.parseInt(result[0]?.total_locks || '0'),
        waitingLocks: Number.parseInt(result[0]?.waiting_locks || '0'),
        deadlocks: Number.parseInt(deadlocks[0]?.deadlocks || '0'),
      };
    } catch (error) {
      this.logger.error('Failed to get lock metrics', error);
      return { totalLocks: 0, waitingLocks: 0, deadlocks: 0 };
    }
  }

  private async getCacheMetrics() {
    try {
      const result = await this.dataSource.query(`
        SELECT 
          sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as buffer_hit_ratio
        FROM pg_statio_user_tables
      `);

      const indexResult = await this.dataSource.query(`
        SELECT 
          sum(idx_blks_hit) / (sum(idx_blks_hit) + sum(idx_blks_read)) * 100 as index_hit_ratio
        FROM pg_statio_user_indexes
      `);

      return {
        hitRatio: Number.parseFloat(indexResult[0]?.index_hit_ratio || '0'),
        bufferHitRatio: Number.parseFloat(result[0]?.buffer_hit_ratio || '0'),
      };
    } catch (error) {
      this.logger.error('Failed to get cache metrics', error);
      return { hitRatio: 0, bufferHitRatio: 0 };
    }
  }

  private async getStorageMetrics() {
    try {
      const dbSize = await this.dataSource.query(`
        SELECT pg_database_size(current_database()) as database_size
      `);

      const indexSize = await this.dataSource.query(`
        SELECT sum(pg_relation_size(indexrelid)) as total_index_size
        FROM pg_stat_user_indexes
      `);

      const tableCount = await this.dataSource.query(`
        SELECT count(*) as table_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `);

      return {
        databaseSize: Number.parseInt(dbSize[0]?.database_size || '0'),
        indexSize: Number.parseInt(indexSize[0]?.total_index_size || '0'),
        tableCount: Number.parseInt(tableCount[0]?.table_count || '0'),
      };
    } catch (error) {
      this.logger.error('Failed to get storage metrics', error);
      return { databaseSize: 0, indexSize: 0, tableCount: 0 };
    }
  }

  private async getReplicationMetrics() {
    try {
      const replicationResult = await this.dataSource.query(`
        SELECT pg_is_in_recovery() as is_replica
      `);

      const isReplica = replicationResult[0]?.is_replica || false;

      if (isReplica) {
        const lagResult = await this.dataSource.query(`
          SELECT 
            CASE 
              WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn() THEN 0
              ELSE EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))
            END as replication_lag
        `);

        return {
          isReplica: true,
          replicationLag: Number.parseFloat(
            lagResult[0]?.replication_lag || '0',
          ),
          replicationStatus: 'active',
        };
      }

      return {
        isReplica: false,
      };
    } catch (error) {
      this.logger.error('Failed to get replication metrics', error);
      return { isReplica: false };
    }
  }

  async getSlowQueries(limit = 20): Promise<SlowQuery[]> {
    try {
      const result = await this.dataSource.query(
        `
        SELECT 
          query,
          mean_exec_time as avg_time,
          total_exec_time as total_time,
          calls,
          rows,
          100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) as hit_ratio
        FROM pg_stat_statements
        WHERE mean_exec_time > 100
        ORDER BY mean_exec_time DESC
        LIMIT $1
      `,
        [limit],
      );

      return result.map((row) => ({
        query: row.query.substring(0, 200) + '...',
        avgTime: Number.parseFloat(row.avg_time),
        totalTime: Number.parseFloat(row.total_time),
        calls: Number.parseInt(row.calls),
        rows: Number.parseInt(row.rows),
        hitRatio: Number.parseFloat(row.hit_ratio || '0'),
        lastSeen: new Date(),
      }));
    } catch (error) {
      this.logger.error('Failed to get slow queries', error);
      return [];
    }
  }

  async getTableStats() {
    try {
      const result = await this.dataSource.query(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        LIMIT 20
      `);

      return result;
    } catch (error) {
      this.logger.error('Failed to get table stats', error);
      return [];
    }
  }

  async getIndexUsage() {
    try {
      const result = await this.dataSource.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
        LIMIT 20
      `);

      return result;
    } catch (error) {
      this.logger.error('Failed to get index usage', error);
      return [];
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledMetricsCollection() {
    try {
      await this.collectDatabaseMetrics();
    } catch (error) {
      this.logger.error('Scheduled database metrics collection failed', error);
    }
  }

  getMetricsHistory(): DatabaseMetrics[] {
    return [...this.metricsHistory];
  }

  getLatestMetrics(): DatabaseMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }
}
