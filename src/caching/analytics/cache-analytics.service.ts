import { Injectable, Logger, type OnModuleInit } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"

export interface CacheMetric {
  timestamp: Date
  key: string
  operation: "hit" | "miss" | "set" | "delete" | "warming" | "invalidation"
  cacheLevel: "local" | "distributed"
  responseTime: number
  size?: number
  strategy?: string
  tags?: string[]
}

export interface CacheAnalytics {
  hitRatio: number
  missRatio: number
  totalOperations: number
  avgResponseTime: number
  memoryUsage: number
  topKeys: KeyAnalytics[]
  performanceByStrategy: StrategyAnalytics[]
  hourlyStats: HourlyStats[]
  recommendations: string[]
}

export interface KeyAnalytics {
  key: string
  hits: number
  misses: number
  hitRatio: number
  avgResponseTime: number
  lastAccessed: Date
  size: number
  frequency: number
}

export interface StrategyAnalytics {
  strategy: string
  usage: number
  hitRatio: number
  avgResponseTime: number
  memoryEfficiency: number
}

export interface HourlyStats {
  hour: number
  hits: number
  misses: number
  hitRatio: number
  operations: number
}

@Injectable()
export class CacheAnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(CacheAnalyticsService.name)
  private metrics: CacheMetric[] = []
  private keyAnalytics = new Map<string, KeyAnalytics>()
  private strategyAnalytics = new Map<string, StrategyAnalytics>()
  private readonly maxMetricsHistory = 10000

  async onModuleInit() {
    this.logger.log("Cache analytics service initialized")
  }

  recordCacheHit(key: string, cacheLevel: "local" | "distributed", responseTime: number): void {
    this.recordMetric({
      timestamp: new Date(),
      key,
      operation: "hit",
      cacheLevel,
      responseTime,
    })

    this.updateKeyAnalytics(key, "hit", responseTime)
  }

  recordCacheMiss(key: string, responseTime: number): void {
    this.recordMetric({
      timestamp: new Date(),
      key,
      operation: "miss",
      cacheLevel: "distributed", // Miss means we checked distributed cache
      responseTime,
    })

    this.updateKeyAnalytics(key, "miss", responseTime)
  }

  recordCacheSet(key: string, size: number, responseTime: number, strategy?: string): void {
    this.recordMetric({
      timestamp: new Date(),
      key,
      operation: "set",
      cacheLevel: "distributed",
      responseTime,
      size,
      strategy,
    })

    if (strategy) {
      this.updateStrategyAnalytics(strategy, "set", responseTime, size)
    }
  }

  recordCacheDelete(key: string): void {
    this.recordMetric({
      timestamp: new Date(),
      key,
      operation: "delete",
      cacheLevel: "distributed",
      responseTime: 0,
    })
  }

  recordCacheWarming(key: string, strategy: string): void {
    this.recordMetric({
      timestamp: new Date(),
      key,
      operation: "warming",
      cacheLevel: "distributed",
      responseTime: 0,
      strategy,
    })

    this.updateStrategyAnalytics(strategy, "warming", 0, 0)
  }

  recordCacheInvalidation(rule: string, keysCount: number, reason: string): void {
    this.recordMetric({
      timestamp: new Date(),
      key: `rule:${rule}`,
      operation: "invalidation",
      cacheLevel: "distributed",
      responseTime: 0,
      size: keysCount,
    })
  }

  private recordMetric(metric: CacheMetric): void {
    this.metrics.push(metric)

    // Keep metrics history manageable
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory)
    }
  }

  private updateKeyAnalytics(key: string, operation: "hit" | "miss", responseTime: number): void {
    let analytics = this.keyAnalytics.get(key)

    if (!analytics) {
      analytics = {
        key,
        hits: 0,
        misses: 0,
        hitRatio: 0,
        avgResponseTime: 0,
        lastAccessed: new Date(),
        size: 0,
        frequency: 0,
      }
      this.keyAnalytics.set(key, analytics)
    }

    if (operation === "hit") {
      analytics.hits++
    } else {
      analytics.misses++
    }

    analytics.lastAccessed = new Date()
    analytics.frequency++

    // Update hit ratio
    const total = analytics.hits + analytics.misses
    analytics.hitRatio = total > 0 ? (analytics.hits / total) * 100 : 0

    // Update average response time
    analytics.avgResponseTime = (analytics.avgResponseTime + responseTime) / 2
  }

  private updateStrategyAnalytics(strategy: string, operation: string, responseTime: number, size: number): void {
    let analytics = this.strategyAnalytics.get(strategy)

    if (!analytics) {
      analytics = {
        strategy,
        usage: 0,
        hitRatio: 0,
        avgResponseTime: 0,
        memoryEfficiency: 0,
      }
      this.strategyAnalytics.set(strategy, analytics)
    }

    analytics.usage++
    analytics.avgResponseTime = (analytics.avgResponseTime + responseTime) / 2

    // Calculate memory efficiency (operations per byte)
    if (size > 0) {
      analytics.memoryEfficiency = analytics.usage / size
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async generateHourlyReport(): Promise<void> {
    const analytics = await this.getAnalytics()
    this.logger.log(`Hourly cache analytics - Hit Ratio: ${analytics.hitRatio.toFixed(2)}%`)

    // Log performance insights
    if (analytics.hitRatio < 80) {
      this.logger.warn(`Cache hit ratio below target: ${analytics.hitRatio.toFixed(2)}%`)
    }

    if (analytics.avgResponseTime > 100) {
      this.logger.warn(`High average response time: ${analytics.avgResponseTime.toFixed(2)}ms`)
    }
  }

  async getAnalytics(): Promise<CacheAnalytics> {
    const now = new Date()
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const recentMetrics = this.metrics.filter((m) => m.timestamp >= last24Hours)

    const hits = recentMetrics.filter((m) => m.operation === "hit").length
    const misses = recentMetrics.filter((m) => m.operation === "miss").length
    const total = hits + misses

    const hitRatio = total > 0 ? (hits / total) * 100 : 0
    const missRatio = 100 - hitRatio

    const avgResponseTime =
      recentMetrics.length > 0 ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length : 0

    const memoryUsage = Array.from(this.keyAnalytics.values()).reduce((sum, ka) => sum + ka.size, 0)

    return {
      hitRatio,
      missRatio,
      totalOperations: total,
      avgResponseTime,
      memoryUsage,
      topKeys: this.getTopKeys(),
      performanceByStrategy: this.getStrategyPerformance(),
      hourlyStats: this.getHourlyStats(),
      recommendations: this.generateRecommendations(hitRatio, avgResponseTime),
    }
  }

  private getTopKeys(limit = 20): KeyAnalytics[] {
    return Array.from(this.keyAnalytics.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit)
  }

  private getStrategyPerformance(): StrategyAnalytics[] {
    return Array.from(this.strategyAnalytics.values()).sort((a, b) => b.usage - a.usage)
  }

  private getHourlyStats(): HourlyStats[] {
    const stats: HourlyStats[] = []
    const now = new Date()

    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
      const hourStart = new Date(hour.getFullYear(), hour.getMonth(), hour.getDate(), hour.getHours())
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)

      const hourMetrics = this.metrics.filter((m) => m.timestamp >= hourStart && m.timestamp < hourEnd)

      const hits = hourMetrics.filter((m) => m.operation === "hit").length
      const misses = hourMetrics.filter((m) => m.operation === "miss").length
      const total = hits + misses

      stats.push({
        hour: hour.getHours(),
        hits,
        misses,
        hitRatio: total > 0 ? (hits / total) * 100 : 0,
        operations: total,
      })
    }

    return stats
  }

  private generateRecommendations(hitRatio: number, avgResponseTime: number): string[] {
    const recommendations: string[] = []

    if (hitRatio < 80) {
      recommendations.push("Consider implementing cache warming for frequently accessed data")
      recommendations.push("Review cache TTL settings - they might be too short")
      recommendations.push("Analyze cache miss patterns to identify optimization opportunities")
    }

    if (avgResponseTime > 100) {
      recommendations.push("Consider using local caching for frequently accessed small objects")
      recommendations.push("Implement compression for large cached objects")
      recommendations.push("Review network latency to Redis instance")
    }

    if (hitRatio > 95) {
      recommendations.push("Excellent cache performance! Consider increasing cache size for more data")
    }

    // Strategy-specific recommendations
    const topStrategy = Array.from(this.strategyAnalytics.values()).sort((a, b) => b.usage - a.usage)[0]
    if (topStrategy && topStrategy.hitRatio < 70) {
      recommendations.push(`Consider optimizing ${topStrategy.strategy} strategy performance`)
    }

    return recommendations
  }

  async getPopularContentIds(limit: number): Promise<string[]> {
    // Simulate getting popular content IDs from analytics
    const popularContent = Array.from(this.keyAnalytics.entries())
      .filter(([key]) => key.startsWith("content:"))
      .sort(([, a], [, b]) => b.frequency - a.frequency)
      .slice(0, limit)
      .map(([key]) => key.split(":")[1])

    return popularContent
  }

  async getActiveUserIds(limit: number): Promise<string[]> {
    // Simulate getting active user IDs
    const activeUsers = Array.from(this.keyAnalytics.entries())
      .filter(([key]) => key.startsWith("user:"))
      .sort(([, a], [, b]) => b.frequency - a.frequency)
      .slice(0, limit)
      .map(([key]) => key.split(":")[2] || key.split(":")[1])
      .filter(Boolean)

    return [...new Set(activeUsers)] // Remove duplicates
  }
}
