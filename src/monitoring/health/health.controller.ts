import { Controller, Get, Logger } from "@nestjs/common"
import type { MonitoringService } from "../monitoring.service"
import type { CachingService } from "../../caching/caching.service"
import type { CacheAnalyticsService } from "../../caching/analytics/cache-analytics.service"

@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name)

  constructor(
    private readonly monitoring: MonitoringService,
    private readonly caching: CachingService,
    private readonly cacheAnalytics: CacheAnalyticsService,
  ) {}

  @Get()
  async getHealth() {
    try {
      const [performanceReport, cacheStats, cacheAnalytics] = await Promise.all([
        this.monitoring.getPerformanceReport(),
        this.caching.getStats(),
        this.cacheAnalytics.getAnalytics(),
      ])

      const health = {
        status: this.determineHealthStatus(performanceReport, cacheStats),
        timestamp: new Date(),
        performance: {
          healthScore: performanceReport?.analysis?.healthScore || 0,
          activeAlerts: performanceReport?.alerts?.length || 0,
          criticalIssues: performanceReport?.analysis?.criticalIssues?.length || 0,
        },
        cache: {
          hitRatio: cacheStats.hitRatio,
          totalKeys: cacheStats.totalKeys,
          memoryUsage: cacheStats.memoryUsage,
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
      }

      return health
    } catch (error) {
      this.logger.error("Health check failed", error)
      return {
        status: "error",
        timestamp: new Date(),
        error: error.message,
      }
    }
  }

  @Get("detailed")
  async getDetailedHealth() {
    try {
      const [performanceReport, cacheAnalytics] = await Promise.all([
        this.monitoring.getPerformanceReport(),
        this.cacheAnalytics.getAnalytics(),
      ])

      return {
        status: "ok",
        timestamp: new Date(),
        performance: performanceReport,
        cache: cacheAnalytics,
        recommendations: [...(performanceReport?.recommendations || []), ...(cacheAnalytics?.recommendations || [])],
      }
    } catch (error) {
      this.logger.error("Detailed health check failed", error)
      return {
        status: "error",
        timestamp: new Date(),
        error: error.message,
      }
    }
  }

  @Get("metrics")
  async getMetrics() {
    try {
      const currentMetrics = this.monitoring.getCurrentMetrics()
      const recentMetrics = this.monitoring.getRecentMetrics(300) // Last 5 minutes

      return {
        current: currentMetrics,
        recent: recentMetrics,
        summary: {
          avgCpuUsage: recentMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / recentMetrics.length,
          avgMemoryUsage:
            recentMetrics.reduce((sum, m) => sum + (m.memory.used / m.memory.total) * 100, 0) / recentMetrics.length,
          avgResponseTime: recentMetrics.reduce((sum, m) => sum + m.http.avgResponseTime, 0) / recentMetrics.length,
        },
      }
    } catch (error) {
      this.logger.error("Metrics retrieval failed", error)
      throw error
    }
  }

  private determineHealthStatus(performanceReport: any, cacheStats: any): string {
    if (!performanceReport || !cacheStats) {
      return "unknown"
    }

    const healthScore = performanceReport.analysis?.healthScore || 0
    const cacheHitRatio = cacheStats.hitRatio || 0
    const criticalIssues = performanceReport.analysis?.criticalIssues?.length || 0

    if (criticalIssues > 0 || healthScore < 50) {
      return "critical"
    }

    if (healthScore < 70 || cacheHitRatio < 60) {
      return "warning"
    }

    if (healthScore >= 90 && cacheHitRatio >= 80) {
      return "excellent"
    }

    return "ok"
  }
}
