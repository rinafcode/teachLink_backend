import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CachingService } from '../caching.service';

export interface CacheMetric {
  key: string;
  pattern: string;
  hits: number;
  misses: number;
  avgResponseTime: number;
  totalRequests: number;
  lastAccess: Date;
}

export interface CacheAnalyticsSummary {
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  missRate: number;
  totalKeys: number;
  memoryUsage: string;
  topKeys: CacheMetric[];
  patternStats: Map<string, { hits: number; misses: number }>;
}

@Injectable()
export class CacheAnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheAnalyticsService.name);
  private metrics: Map<string, CacheMetric> = new Map();
  private flushInterval?: NodeJS.Timeout;
  private readonly flushIntervalMs = 60000; // Flush every minute

  constructor(private readonly cachingService: CachingService) {}

  onModuleInit(): void {
    // Start periodic metrics aggregation
    this.startMetricsFlush();
    this.logger.log('Cache analytics service initialized');
  }

  onModuleDestroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.metrics.clear();
  }

  /**
   * Record a cache hit
   */
  recordHit(key: string, responseTime?: number): void {
    const pattern = this.extractPattern(key);
    const metric = this.getOrCreateMetric(key, pattern);

    metric.hits++;
    metric.totalRequests++;
    metric.lastAccess = new Date();

    if (responseTime !== undefined) {
      this.updateAvgResponseTime(metric, responseTime);
    }
  }

  /**
   * Record a cache miss
   */
  recordMiss(key: string, responseTime?: number): void {
    const pattern = this.extractPattern(key);
    const metric = this.getOrCreateMetric(key, pattern);

    metric.misses++;
    metric.totalRequests++;
    metric.lastAccess = new Date();

    if (responseTime !== undefined) {
      this.updateAvgResponseTime(metric, responseTime);
    }
  }

  /**
   * Get metrics for a specific key
   */
  getMetric(key: string): CacheMetric | undefined {
    return this.metrics.get(key);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): CacheMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics by pattern
   */
  getMetricsByPattern(pattern: string): CacheMetric[] {
    return this.getAllMetrics().filter((m) => m.pattern === pattern);
  }

  /**
   * Get analytics summary
   */
  async getSummary(): Promise<CacheAnalyticsSummary> {
    const allMetrics = this.getAllMetrics();
    const stats = await this.cachingService.getStats();

    let totalHits = 0;
    let totalMisses = 0;
    const patternStats = new Map<string, { hits: number; misses: number }>();

    for (const metric of allMetrics) {
      totalHits += metric.hits;
      totalMisses += metric.misses;

      const patternStat = patternStats.get(metric.pattern) || { hits: 0, misses: 0 };
      patternStat.hits += metric.hits;
      patternStat.misses += metric.misses;
      patternStats.set(metric.pattern, patternStat);
    }

    const totalRequests = totalHits + totalMisses;
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (totalMisses / totalRequests) * 100 : 0;

    // Get top 10 keys by total requests
    const topKeys = allMetrics.sort((a, b) => b.totalRequests - a.totalRequests).slice(0, 10);

    return {
      totalHits,
      totalMisses,
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round(missRate * 100) / 100,
      totalKeys: stats.keys,
      memoryUsage: stats.memory,
      topKeys,
      patternStats,
    };
  }

  /**
   * Get hit rate for a specific pattern
   */
  getPatternHitRate(pattern: string): number {
    const metrics = this.getMetricsByPattern(pattern);
    if (metrics.length === 0) return 0;

    let hits = 0;
    let total = 0;

    for (const metric of metrics) {
      hits += metric.hits;
      total += metric.totalRequests;
    }

    return total > 0 ? (hits / total) * 100 : 0;
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics.clear();
    this.logger.log('Cache metrics reset');
  }

  /**
   * Reset metrics for a specific pattern
   */
  resetPatternMetrics(pattern: string): void {
    for (const [key, metric] of this.metrics.entries()) {
      if (metric.pattern === pattern) {
        this.metrics.delete(key);
      }
    }
    this.logger.log(`Reset metrics for pattern: ${pattern}`);
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics(): Record<string, any> {
    const summary: Record<string, any> = {
      timestamp: new Date().toISOString(),
      metrics: {},
    };

    for (const [key, metric] of this.metrics.entries()) {
      summary.metrics[key] = {
        hits: metric.hits,
        misses: metric.misses,
        hitRate: metric.totalRequests > 0 ? (metric.hits / metric.totalRequests) * 100 : 0,
        missRate: metric.totalRequests > 0 ? (metric.misses / metric.totalRequests) * 100 : 0,
        avgResponseTime: metric.avgResponseTime,
      };
    }

    return summary;
  }

  /**
   * Get or create a metric entry
   */
  private getOrCreateMetric(key: string, pattern: string): CacheMetric {
    let metric = this.metrics.get(key);

    if (!metric) {
      metric = {
        key,
        pattern,
        hits: 0,
        misses: 0,
        avgResponseTime: 0,
        totalRequests: 0,
        lastAccess: new Date(),
      };
      this.metrics.set(key, metric);
    }

    return metric;
  }

  /**
   * Extract pattern from key
   * e.g., 'cache:course:123' -> 'cache:course:*'
   */
  private extractPattern(key: string): string {
    const parts = key.split(':');
    if (parts.length <= 2) {
      return key;
    }

    // Keep prefix and first segment, replace rest with *
    return `${parts[0]}:${parts[1]}:*`;
  }

  /**
   * Update average response time using exponential moving average
   */
  private updateAvgResponseTime(metric: CacheMetric, responseTime: number): void {
    const alpha = 0.2; // Smoothing factor
    metric.avgResponseTime = alpha * responseTime + (1 - alpha) * metric.avgResponseTime;
  }

  /**
   * Start periodic metrics flush to prevent memory bloat
   */
  private startMetricsFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushOldMetrics();
    }, this.flushIntervalMs);
  }

  /**
   * Remove old metrics that haven't been accessed recently
   */
  private flushOldMetrics(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    let flushed = 0;

    for (const [key, metric] of this.metrics.entries()) {
      const age = now - metric.lastAccess.getTime();
      if (age > maxAge) {
        this.metrics.delete(key);
        flushed++;
      }
    }

    if (flushed > 0) {
      this.logger.debug(`Flushed ${flushed} old metrics entries`);
    }
  }

  /**
   * Get Prometheus-style metrics
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    lines.push('# HELP cache_hits_total Total number of cache hits');
    lines.push('# TYPE cache_hits_total counter');

    for (const metric of this.metrics.values()) {
      lines.push(`cache_hits_total{pattern="${metric.pattern}"} ${metric.hits}`);
    }

    lines.push('');
    lines.push('# HELP cache_misses_total Total number of cache misses');
    lines.push('# TYPE cache_misses_total counter');

    for (const metric of this.metrics.values()) {
      lines.push(`cache_misses_total{pattern="${metric.pattern}"} ${metric.misses}`);
    }

    lines.push('');
    lines.push('# HELP cache_avg_response_time_ms Average response time in ms');
    lines.push('# TYPE cache_avg_response_time_ms gauge');

    for (const metric of this.metrics.values()) {
      lines.push(
        `cache_avg_response_time_ms{pattern="${metric.pattern}"} ${Math.round(metric.avgResponseTime)}`,
      );
    }

    return lines.join('\n');
  }
}
