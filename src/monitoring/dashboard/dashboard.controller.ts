import { Controller, Get, Param, Post, Body, Logger } from "@nestjs/common"
import type { MonitoringService } from "../monitoring.service"
import type { CachingService } from "../../caching/caching.service"
import type { CacheAnalyticsService } from "../../caching/analytics/cache-analytics.service"
import type { AlertingService } from "../alerting/alerting.service"
import type { OptimizationService } from "../optimization/optimization.service"

@Controller("dashboard")
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name)

  constructor(
    private readonly monitoring: MonitoringService,
    private readonly caching: CachingService,
    private readonly cacheAnalytics: CacheAnalyticsService,
    private readonly alerting: AlertingService,
    private readonly optimization: OptimizationService,
  ) {}

  @Get("overview")
  async getOverview() {
    try {
      const [performanceReport, cacheAnalytics, alertStats] = await Promise.all([
        this.monitoring.getPerformanceReport(),
        this.cacheAnalytics.getAnalytics(),
        this.alerting.getAlertStatistics(),
      ])

      return {
        timestamp: new Date(),
        performance: {
          healthScore: performanceReport?.analysis?.healthScore || 0,
          bottlenecks: performanceReport?.analysis?.bottlenecks?.length || 0,
          trends: performanceReport?.analysis?.trends || [],
        },
        cache: {
          hitRatio: cacheAnalytics.hitRatio,
          totalOperations: cacheAnalytics.totalOperations,
          avgResponseTime: cacheAnalytics.avgResponseTime,
          memoryUsage: cacheAnalytics.memoryUsage,
        },
        alerts: {
          active: alertStats.active,
          last24Hours: alertStats.last24Hours,
          bySeverity: alertStats.bySeverity,
        },
        recommendations: [
          ...(performanceReport?.recommendations || []),
          ...(cacheAnalytics.recommendations || []),
        ].slice(0, 10), // Top 10 recommendations
      }
    } catch (error) {
      this.logger.error("Dashboard overview failed", error)
      throw error
    }
  }

  @Get("performance")
  async getPerformanceData(timeRange = "1h") {
    try {
      const seconds = this.parseTimeRange(timeRange)
      const metrics = this.monitoring.getRecentMetrics(seconds)

      return {
        timeRange,
        dataPoints: metrics.length,
        metrics: metrics.map((m) => ({
          timestamp: m.timestamp,
          cpu: m.cpu.usage,
          memory: (m.memory.used / m.memory.total) * 100,
          responseTime: m.http.avgResponseTime,
          errorRate: m.http.errorRate,
          eventLoopDelay: m.eventLoop.delay,
        })),
        summary: this.calculateMetricsSummary(metrics),
      }
    } catch (error) {
      this.logger.error("Performance data retrieval failed", error)
      throw error
    }
  }

  @Get("cache")
  async getCacheData() {
    try {
      const [analytics, topKeys, strategies] = await Promise.all([
        this.cacheAnalytics.getAnalytics(),
        this.cacheAnalytics.getAnalytics().then((a) => a.topKeys),
        this.cacheAnalytics.getAnalytics().then((a) => a.performanceByStrategy),
      ])

      return {
        overview: {
          hitRatio: analytics.hitRatio,
          missRatio: analytics.missRatio,
          totalOperations: analytics.totalOperations,
          avgResponseTime: analytics.avgResponseTime,
          memoryUsage: analytics.memoryUsage,
        },
        topKeys: topKeys.slice(0, 20),
        strategies: strategies,
        hourlyStats: analytics.hourlyStats,
        recommendations: analytics.recommendations,
      }
    } catch (error) {
      this.logger.error("Cache data retrieval failed", error)
      throw error
    }
  }

  @Get("alerts")
  async getAlerts(status?: string) {
    try {
      const [activeAlerts, alertHistory, alertStats] = await Promise.all([
        this.alerting.getActiveAlerts(),
        this.alerting.getAlertHistory(100),
        this.alerting.getAlertStatistics(),
      ])

      let filteredAlerts = activeAlerts
      if (status) {
        filteredAlerts = activeAlerts.filter((alert) =>
          status === "active"
            ? !alert.acknowledged && !alert.resolvedAt
            : status === "acknowledged"
              ? alert.acknowledged
              : status === "resolved"
                ? alert.resolvedAt
                : true,
        )
      }

      return {
        active: filteredAlerts,
        history: alertHistory,
        statistics: alertStats,
      }
    } catch (error) {
      this.logger.error("Alerts data retrieval failed", error)
      throw error
    }
  }

  @Post('alerts/:id/acknowledge')
  async acknowledgeAlert(@Param('id') alertId: string) {
    try {
      await this.alerting.acknowledgeAlert(alertId)
      return { success: true, message: 'Alert acknowledged' }
    } catch (error) {
      this.logger.error(`Failed to acknowledge alert ${alertId}`, error)
      throw error
    }
  }

  @Post('alerts/:id/resolve')
  async resolveAlert(@Param('id') alertId: string) {
    try {
      await this.alerting.resolveAlert(alertId)
      return { success: true, message: 'Alert resolved' }
    } catch (error) {
      this.logger.error(`Failed to resolve alert ${alertId}`, error)
      throw error
    }
  }

  @Get("optimizations")
  async getOptimizations() {
    try {
      const recommendations = await this.optimization.getActiveRecommendations()

      return {
        active: recommendations,
        byType: this.groupRecommendationsByType(recommendations),
        byPriority: this.groupRecommendationsByPriority(recommendations),
      }
    } catch (error) {
      this.logger.error("Optimizations data retrieval failed", error)
      throw error
    }
  }

  @Post('optimizations/:id/apply')
  async applyOptimization(@Param('id') recommendationId: string) {
    try {
      await this.optimization.markRecommendationAsApplied(recommendationId)
      return { success: true, message: 'Optimization applied' }
    } catch (error) {
      this.logger.error(`Failed to apply optimization ${recommendationId}`, error)
      throw error
    }
  }

  @Post('cache/clear')
  async clearCache(@Body() body: { pattern?: string; tags?: string[] }) {
    try {
      if (body.pattern) {
        await this.caching.deleteByPattern(body.pattern)
      } else if (body.tags) {
        await this.caching.deleteByTags(body.tags)
      } else {
        await this.caching.clear()
      }
      
      return { success: true, message: 'Cache cleared' }
    } catch (error) {
      this.logger.error('Cache clear failed', error)
      throw error
    }
  }

  @Post('cache/warm')
  async warmCache(@Body() body: { keys: string[] }) {
    try {
      // This would typically use your actual data loading logic
      const dataLoader = async (key: string) => {
        return { key, data: 'warmed', timestamp: new Date() }
      }

      await this.caching.warmup(body.keys, dataLoader)
      return { success: true, message: `Warmed ${body.keys.length} cache keys` }
    } catch (error) {
      this.logger.error('Cache warming failed', error)
      throw error
    }
  }

  private parseTimeRange(timeRange: string): number {
    const unit = timeRange.slice(-1)
    const value = Number.parseInt(timeRange.slice(0, -1))

    switch (unit) {
      case "m":
        return value * 60
      case "h":
        return value * 3600
      case "d":
        return value * 86400
      default:
        return 3600 // Default to 1 hour
    }
  }

  private calculateMetricsSummary(metrics: any[]) {
    if (metrics.length === 0) return null

    return {
      avgCpu: metrics.reduce((sum, m) => sum + m.cpu.usage, 0) / metrics.length,
      avgMemory: metrics.reduce((sum, m) => sum + (m.memory.used / m.memory.total) * 100, 0) / metrics.length,
      avgResponseTime: metrics.reduce((sum, m) => sum + m.http.avgResponseTime, 0) / metrics.length,
      avgErrorRate: metrics.reduce((sum, m) => sum + m.http.errorRate, 0) / metrics.length,
      maxCpu: Math.max(...metrics.map((m) => m.cpu.usage)),
      maxMemory: Math.max(...metrics.map((m) => (m.memory.used / m.memory.total) * 100)),
      maxResponseTime: Math.max(...metrics.map((m) => m.http.avgResponseTime)),
    }
  }

  private groupRecommendationsByType(recommendations: any[]) {
    return recommendations.reduce((groups, rec) => {
      const type = rec.type
      if (!groups[type]) groups[type] = []
      groups[type].push(rec)
      return groups
    }, {})
  }

  private groupRecommendationsByPriority(recommendations: any[]) {
    return recommendations.reduce((groups, rec) => {
      const priority = rec.priority
      if (!groups[priority]) groups[priority] = []
      groups[priority].push(rec)
      return groups
    }, {})
  }
}
