import { Injectable, Logger, type OnModuleInit } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import type { MetricsCollectionService } from "./metrics/metrics-collection.service"
import type { PerformanceAnalysisService } from "./performance/performance-analysis.service"
import type { OptimizationService } from "./optimization/optimization.service"
import type { AlertingService } from "./alerting/alerting.service"

export interface PerformanceMetrics {
  timestamp: Date
  cpu: {
    usage: number
    loadAverage: number[]
  }
  memory: {
    used: number
    free: number
    total: number
    heapUsed: number
    heapTotal: number
  }
  database: {
    activeConnections: number
    slowQueries: number
    avgQueryTime: number
  }
  http: {
    requestsPerSecond: number
    avgResponseTime: number
    errorRate: number
  }
  eventLoop: {
    delay: number
    utilization: number
  }
}

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name)
  private metricsHistory: PerformanceMetrics[] = []
  private readonly maxHistorySize = 1000

  constructor(
    private readonly metricsCollection: MetricsCollectionService,
    private readonly performanceAnalysis: PerformanceAnalysisService,
    private readonly optimization: OptimizationService,
    private readonly alerting: AlertingService,
  ) {}

  async onModuleInit() {
    this.logger.log("Performance monitoring system initialized")
    await this.startMonitoring()
  }

  async startMonitoring() {
    this.logger.log("Starting performance monitoring...")

    // Initialize metrics collection
    await this.metricsCollection.initialize()

    // Start real-time monitoring
    this.collectMetrics()
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async collectMetrics() {
    try {
      const metrics = await this.metricsCollection.collectAllMetrics()
      this.addToHistory(metrics)

      // Analyze performance in real-time
      const analysis = await this.performanceAnalysis.analyzeMetrics(metrics, this.metricsHistory)

      // Check for alerts
      await this.alerting.checkThresholds(metrics, analysis)

      // Generate optimization recommendations if needed
      if (analysis.hasBottlenecks) {
        const recommendations = await this.optimization.generateRecommendations(metrics, analysis)
        this.logger.warn("Performance bottlenecks detected", { recommendations })
      }
    } catch (error) {
      this.logger.error("Error collecting metrics", error)
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async performDeepAnalysis() {
    try {
      const recentMetrics = this.getRecentMetrics(300) // Last 5 minutes
      const deepAnalysis = await this.performanceAnalysis.performDeepAnalysis(recentMetrics)

      if (deepAnalysis.regressionDetected) {
        await this.alerting.sendRegressionAlert(deepAnalysis)
      }

      // Auto-optimization for critical issues
      if (deepAnalysis.criticalIssues.length > 0) {
        await this.optimization.applyAutoOptimizations(deepAnalysis.criticalIssues)
      }
    } catch (error) {
      this.logger.error("Error in deep analysis", error)
    }
  }

  private addToHistory(metrics: PerformanceMetrics) {
    this.metricsHistory.push(metrics)

    // Keep history size manageable
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize)
    }
  }

  getRecentMetrics(seconds: number): PerformanceMetrics[] {
    const cutoff = new Date(Date.now() - seconds * 1000)
    return this.metricsHistory.filter((m) => m.timestamp >= cutoff)
  }

  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null
  }

  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory]
  }

  async getPerformanceReport() {
    const currentMetrics = this.getCurrentMetrics()
    const recentMetrics = this.getRecentMetrics(3600) // Last hour

    if (!currentMetrics) {
      return null
    }

    const analysis = await this.performanceAnalysis.generateReport(recentMetrics)
    const recommendations = await this.optimization.getActiveRecommendations()

    return {
      timestamp: new Date(),
      current: currentMetrics,
      analysis,
      recommendations,
      alerts: await this.alerting.getActiveAlerts(),
    }
  }
}
