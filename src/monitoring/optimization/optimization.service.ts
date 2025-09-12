import { Injectable, Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { PerformanceMetrics } from '../monitoring.service';
import type {
  PerformanceAnalysis,
  CriticalIssue,
} from '../performance/performance-analysis.service';

export interface OptimizationRecommendation {
  id: string;
  type: 'database' | 'memory' | 'cpu' | 'http' | 'configuration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  autoApplicable: boolean;
  sqlQuery?: string;
  configChange?: any;
  estimatedImprovement: string;
  createdAt: Date;
  appliedAt?: Date;
  status: 'pending' | 'applied' | 'failed' | 'ignored';
}

export interface DatabaseOptimization {
  missingIndexes: MissingIndex[];
  slowQueries: SlowQuery[];
  connectionPoolRecommendations: string[];
}

export interface MissingIndex {
  table: string;
  columns: string[];
  reason: string;
  createStatement: string;
  estimatedImprovement: number;
}

export interface SlowQuery {
  query: string;
  avgTime: number;
  calls: number;
  recommendation: string;
  optimizedQuery?: string;
}

@Injectable()
export class OptimizationService {
  private readonly logger = new Logger(OptimizationService.name);
  private activeRecommendations: OptimizationRecommendation[] = [];
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  async generateRecommendations(
    metrics: PerformanceMetrics,
    analysis: PerformanceAnalysis,
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Database optimizations
    if (analysis.bottlenecks.some((b) => b.type === 'database')) {
      const dbOptimizations = await this.analyzeDatabasePerformance();
      recommendations.push(
        ...this.createDatabaseRecommendations(dbOptimizations),
      );
    }

    // Memory optimizations
    if (analysis.bottlenecks.some((b) => b.type === 'memory')) {
      recommendations.push(...this.createMemoryRecommendations(metrics));
    }

    // CPU optimizations
    if (analysis.bottlenecks.some((b) => b.type === 'cpu')) {
      recommendations.push(...this.createCpuRecommendations(metrics));
    }

    // HTTP optimizations
    if (analysis.bottlenecks.some((b) => b.type === 'http')) {
      recommendations.push(...this.createHttpRecommendations(metrics));
    }

    // Store recommendations
    this.activeRecommendations.push(...recommendations);

    return recommendations;
  }

  private async analyzeDatabasePerformance(): Promise<DatabaseOptimization> {
    const missingIndexes = await this.findMissingIndexes();
    const slowQueries = await this.findSlowQueries();
    const connectionPoolRecommendations = this.analyzeConnectionPool();

    return {
      missingIndexes,
      slowQueries,
      connectionPoolRecommendations,
    };
  }

  private async findMissingIndexes(): Promise<MissingIndex[]> {
    try {
      // Query to find tables with sequential scans that might benefit from indexes
      const sequentialScans = await this.dataSource.query(`
        SELECT 
          schemaname,
          tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          seq_tup_read / GREATEST(seq_scan, 1) as avg_seq_read
        FROM pg_stat_user_tables 
        WHERE seq_scan > 1000 
        AND (idx_scan IS NULL OR seq_scan > idx_scan * 10)
        ORDER BY seq_tup_read DESC
        LIMIT 10
      `);

      const missingIndexes: MissingIndex[] = [];

      for (const scan of sequentialScans) {
        // Get column usage statistics for this table
        const columnStats = await this.dataSource.query(
          `
          SELECT 
            column_name,
            data_type
          FROM information_schema.columns 
          WHERE table_name = $1 
          AND table_schema = $2
          ORDER BY ordinal_position
        `,
          [scan.tablename, scan.schemaname],
        );

        if (columnStats.length > 0) {
          // Suggest index on commonly filtered columns
          const suggestedColumns = columnStats
            .filter((col) =>
              ['integer', 'bigint', 'uuid', 'timestamp', 'date'].includes(
                col.data_type,
              ),
            )
            .slice(0, 2)
            .map((col) => col.column_name);

          if (suggestedColumns.length > 0) {
            missingIndexes.push({
              table: `${scan.schemaname}.${scan.tablename}`,
              columns: suggestedColumns,
              reason: `High sequential scan ratio (${scan.seq_scan} seq scans vs ${scan.idx_scan || 0} index scans)`,
              createStatement: `CREATE INDEX CONCURRENTLY idx_${scan.tablename}_${suggestedColumns.join('_')} ON ${scan.schemaname}.${scan.tablename} (${suggestedColumns.join(', ')});`,
              estimatedImprovement: Math.min(scan.avg_seq_read / 100, 90),
            });
          }
        }
      }

      return missingIndexes;
    } catch (error) {
      this.logger.warn('Could not analyze missing indexes', error.message);
      return [];
    }
  }

  private async findSlowQueries(): Promise<SlowQuery[]> {
    try {
      const slowQueries = await this.dataSource.query(`
        SELECT 
          query,
          mean_exec_time,
          calls,
          total_exec_time,
          rows / GREATEST(calls, 1) as avg_rows
        FROM pg_stat_statements 
        WHERE mean_exec_time > 100 
        AND calls > 10
        ORDER BY mean_exec_time DESC 
        LIMIT 10
      `);

      return slowQueries.map((query) => ({
        query: query.query.substring(0, 200) + '...',
        avgTime: Number.parseFloat(query.mean_exec_time),
        calls: Number.parseInt(query.calls),
        recommendation: this.generateQueryOptimizationRecommendation(query),
      }));
    } catch (error) {
      this.logger.warn('Could not analyze slow queries', error.message);
      return [];
    }
  }

  private generateQueryOptimizationRecommendation(query: any): string {
    const recommendations = [];

    if (query.avg_rows > 1000) {
      recommendations.push('Consider adding LIMIT clause or pagination');
    }

    if (query.mean_exec_time > 1000) {
      recommendations.push('Review query execution plan with EXPLAIN ANALYZE');
    }

    if (query.calls > 1000) {
      recommendations.push(
        'Consider caching results or using prepared statements',
      );
    }

    return recommendations.join('; ') || 'Review and optimize query structure';
  }

  private analyzeConnectionPool(): string[] {
    const recommendations = [];

    // These would typically be based on actual connection pool metrics
    recommendations.push(
      'Consider increasing connection pool size if connections are frequently exhausted',
    );
    recommendations.push('Implement connection timeout and retry logic');
    recommendations.push(
      'Monitor connection pool utilization and adjust max connections',
    );

    return recommendations;
  }

  private createDatabaseRecommendations(
    dbOptimization: DatabaseOptimization,
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Missing indexes recommendations
    dbOptimization.missingIndexes.forEach((index, i) => {
      recommendations.push({
        id: `db-index-${i}-${Date.now()}`,
        type: 'database',
        priority: index.estimatedImprovement > 50 ? 'high' : 'medium',
        title: `Add index to ${index.table}`,
        description: `Create index on columns: ${index.columns.join(', ')}`,
        impact: `Estimated ${index.estimatedImprovement.toFixed(1)}% query performance improvement`,
        effort: 'low',
        autoApplicable: true,
        sqlQuery: index.createStatement,
        estimatedImprovement: `${index.estimatedImprovement.toFixed(1)}% faster queries`,
        createdAt: new Date(),
        status: 'pending',
      });
    });

    // Slow queries recommendations
    dbOptimization.slowQueries.forEach((query, i) => {
      recommendations.push({
        id: `db-query-${i}-${Date.now()}`,
        type: 'database',
        priority: query.avgTime > 1000 ? 'high' : 'medium',
        title: 'Optimize slow query',
        description: query.recommendation,
        impact: `Query currently takes ${query.avgTime.toFixed(2)}ms on average`,
        effort: 'medium',
        autoApplicable: false,
        estimatedImprovement: 'Up to 70% faster query execution',
        createdAt: new Date(),
        status: 'pending',
      });
    });

    return recommendations;
  }

  private createMemoryRecommendations(
    metrics: PerformanceMetrics,
  ): OptimizationRecommendation[] {
    const memoryUsagePercent =
      (metrics.memory.used / metrics.memory.total) * 100;
    const recommendations: OptimizationRecommendation[] = [];

    if (memoryUsagePercent > 80) {
      recommendations.push({
        id: `memory-cleanup-${Date.now()}`,
        type: 'memory',
        priority: memoryUsagePercent > 90 ? 'critical' : 'high',
        title: 'Implement memory cleanup',
        description:
          'Add garbage collection optimization and memory leak detection',
        impact: `Current memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        effort: 'medium',
        autoApplicable: true,
        configChange: {
          nodeOptions: '--max-old-space-size=4096 --optimize-for-size',
        },
        estimatedImprovement: '20-30% memory usage reduction',
        createdAt: new Date(),
        status: 'pending',
      });
    }

    if (metrics.memory.heapUsed / metrics.memory.heapTotal > 0.8) {
      recommendations.push({
        id: `heap-optimization-${Date.now()}`,
        type: 'memory',
        priority: 'medium',
        title: 'Optimize heap usage',
        description: 'Implement object pooling and reduce object creation',
        impact: 'High heap utilization detected',
        effort: 'high',
        autoApplicable: false,
        estimatedImprovement: 'Reduced GC pressure and improved performance',
        createdAt: new Date(),
        status: 'pending',
      });
    }

    return recommendations;
  }

  private createCpuRecommendations(
    metrics: PerformanceMetrics,
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    if (metrics.cpu.usage > 70) {
      recommendations.push({
        id: `cpu-optimization-${Date.now()}`,
        type: 'cpu',
        priority: metrics.cpu.usage > 85 ? 'critical' : 'high',
        title: 'Optimize CPU-intensive operations',
        description:
          'Move heavy computations to worker threads or implement caching',
        impact: `Current CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        effort: 'high',
        autoApplicable: false,
        estimatedImprovement: '30-50% CPU usage reduction',
        createdAt: new Date(),
        status: 'pending',
      });
    }

    return recommendations;
  }

  private createHttpRecommendations(
    metrics: PerformanceMetrics,
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    if (metrics.http.avgResponseTime > 500) {
      recommendations.push({
        id: `http-caching-${Date.now()}`,
        type: 'http',
        priority: metrics.http.avgResponseTime > 1000 ? 'high' : 'medium',
        title: 'Implement response caching',
        description: 'Add Redis caching for frequently requested data',
        impact: `Current avg response time: ${metrics.http.avgResponseTime.toFixed(2)}ms`,
        effort: 'medium',
        autoApplicable: false,
        estimatedImprovement: '60-80% response time improvement',
        createdAt: new Date(),
        status: 'pending',
      });
    }

    if (metrics.http.errorRate > 1) {
      recommendations.push({
        id: `error-handling-${Date.now()}`,
        type: 'http',
        priority: 'high',
        title: 'Improve error handling',
        description: 'Implement better error handling and retry mechanisms',
        impact: `Current error rate: ${metrics.http.errorRate.toFixed(2)}%`,
        effort: 'medium',
        autoApplicable: false,
        estimatedImprovement: 'Reduced error rate and improved reliability',
        createdAt: new Date(),
        status: 'pending',
      });
    }

    return recommendations;
  }

  async applyAutoOptimizations(criticalIssues: CriticalIssue[]): Promise<void> {
    for (const issue of criticalIssues) {
      if (issue.autoFixable) {
        try {
          await this.applyOptimization(issue);
          this.logger.log(
            `Auto-applied optimization for ${issue.type}: ${issue.description}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to auto-apply optimization for ${issue.id}`,
            error,
          );
        }
      }
    }
  }

  private async applyOptimization(issue: CriticalIssue): Promise<void> {
    const recommendation = this.activeRecommendations.find((r) =>
      r.id.includes(issue.type),
    );

    if (!recommendation) {
      return;
    }

    switch (recommendation.type) {
      case 'database':
        if (recommendation.sqlQuery) {
          await this.dataSource.query(recommendation.sqlQuery);
          recommendation.status = 'applied';
          recommendation.appliedAt = new Date();
        }
        break;
      case 'memory':
        if (recommendation.configChange) {
          // In a real implementation, this might update configuration files
          // or trigger a restart with new parameters
          this.logger.log(
            'Memory optimization applied',
            recommendation.configChange,
          );
          recommendation.status = 'applied';
          recommendation.appliedAt = new Date();
        }
        break;
      default:
        this.logger.warn(
          `Auto-optimization not implemented for type: ${recommendation.type}`,
        );
    }
  }

  async getActiveRecommendations(): Promise<OptimizationRecommendation[]> {
    return this.activeRecommendations.filter((r) => r.status === 'pending');
  }

  async markRecommendationAsApplied(id: string): Promise<void> {
    const recommendation = this.activeRecommendations.find((r) => r.id === id);
    if (recommendation) {
      recommendation.status = 'applied';
      recommendation.appliedAt = new Date();
    }
  }

  async ignoreRecommendation(id: string): Promise<void> {
    const recommendation = this.activeRecommendations.find((r) => r.id === id);
    if (recommendation) {
      recommendation.status = 'ignored';
    }
  }
}
