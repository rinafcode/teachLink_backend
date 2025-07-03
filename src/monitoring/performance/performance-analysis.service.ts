import { Injectable, Logger } from "@nestjs/common"
import type { PerformanceMetrics } from "../monitoring.service"

export interface PerformanceAnalysis {
  hasBottlenecks: boolean
  bottlenecks: BottleneckInfo[]
  trends: PerformanceTrend[]
  healthScore: number
  criticalIssues: CriticalIssue[]
  regressionDetected: boolean
}

export interface BottleneckInfo {
  type: "cpu" | "memory" | "database" | "http" | "eventloop"
  severity: "low" | "medium" | "high" | "critical"
  description: string
  currentValue: number
  threshold: number
  impact: string
}

export interface PerformanceTrend {
  metric: string
  direction: "improving" | "degrading" | "stable"
  changePercent: number
  timeframe: string
}

export interface CriticalIssue {
  id: string
  type: string
  description: string
  severity: number
  autoFixable: boolean
  recommendation: string
}

@Injectable()
export class PerformanceAnalysisService {
  private readonly logger = new Logger(PerformanceAnalysisService.name)

  // Performance thresholds
  private readonly thresholds = {
    cpu: { warning: 70, critical: 85 },
    memory: { warning: 80, critical: 90 },
    dbConnections: { warning: 80, critical: 95 },
    avgResponseTime: { warning: 500, critical: 1000 },
    errorRate: { warning: 1, critical: 5 },
    eventLoopDelay: { warning: 10, critical: 50 },
  }

  async analyzeMetrics(current: PerformanceMetrics, history: PerformanceMetrics[]): Promise<PerformanceAnalysis> {
    const bottlenecks = this.detectBottlenecks(current)
    const trends = this.analyzeTrends(history)
    const healthScore = this.calculateHealthScore(current, bottlenecks)
    const criticalIssues = this.identifyCriticalIssues(current, bottlenecks)
    const regressionDetected = this.detectRegression(history)

    return {
      hasBottlenecks: bottlenecks.length > 0,
      bottlenecks,
      trends,
      healthScore,
      criticalIssues,
      regressionDetected,
    }
  }

  private detectBottlenecks(metrics: PerformanceMetrics): BottleneckInfo[] {
    const bottlenecks: BottleneckInfo[] = []

    // CPU bottleneck detection
    if (metrics.cpu.usage > this.thresholds.cpu.warning) {
      bottlenecks.push({
        type: "cpu",
        severity: metrics.cpu.usage > this.thresholds.cpu.critical ? "critical" : "high",
        description: `High CPU usage detected: ${metrics.cpu.usage.toFixed(1)}%`,
        currentValue: metrics.cpu.usage,
        threshold: this.thresholds.cpu.warning,
        impact: "May cause request timeouts and poor user experience",
      })
    }

    // Memory bottleneck detection
    const memoryUsagePercent = (metrics.memory.used / metrics.memory.total) * 100
    if (memoryUsagePercent > this.thresholds.memory.warning) {
      bottlenecks.push({
        type: "memory",
        severity: memoryUsagePercent > this.thresholds.memory.critical ? "critical" : "high",
        description: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        currentValue: memoryUsagePercent,
        threshold: this.thresholds.memory.warning,
        impact: "Risk of out-of-memory errors and application crashes",
      })
    }

    // Database bottleneck detection
    if (metrics.database.avgQueryTime > this.thresholds.avgResponseTime.warning) {
      bottlenecks.push({
        type: "database",
        severity: metrics.database.avgQueryTime > this.thresholds.avgResponseTime.critical ? "critical" : "high",
        description: `Slow database queries: ${metrics.database.avgQueryTime.toFixed(2)}ms average`,
        currentValue: metrics.database.avgQueryTime,
        threshold: this.thresholds.avgResponseTime.warning,
        impact: "Increased response times and poor application performance",
      })
    }

    // HTTP performance bottleneck
    if (metrics.http.avgResponseTime > this.thresholds.avgResponseTime.warning) {
      bottlenecks.push({
        type: "http",
        severity: metrics.http.avgResponseTime > this.thresholds.avgResponseTime.critical ? "critical" : "high",
        description: `Slow HTTP responses: ${metrics.http.avgResponseTime.toFixed(2)}ms average`,
        currentValue: metrics.http.avgResponseTime,
        threshold: this.thresholds.avgResponseTime.warning,
        impact: "Poor user experience and potential timeouts",
      })
    }

    // Event loop bottleneck
    if (metrics.eventLoop.delay > this.thresholds.eventLoopDelay.warning) {
      bottlenecks.push({
        type: "eventloop",
        severity: metrics.eventLoop.delay > this.thresholds.eventLoopDelay.critical ? "critical" : "high",
        description: `Event loop delay: ${metrics.eventLoop.delay.toFixed(2)}ms`,
        currentValue: metrics.eventLoop.delay,
        threshold: this.thresholds.eventLoopDelay.warning,
        impact: "Blocked event loop causing unresponsive application",
      })
    }

    return bottlenecks
  }

  private analyzeTrends(history: PerformanceMetrics[]): PerformanceTrend[] {
    if (history.length < 10) {
      return []
    }

    const trends: PerformanceTrend[] = []
    const recent = history.slice(-5)
    const previous = history.slice(-10, -5)

    // Analyze CPU trend
    const recentCpuAvg = recent.reduce((sum, m) => sum + m.cpu.usage, 0) / recent.length
    const previousCpuAvg = previous.reduce((sum, m) => sum + m.cpu.usage, 0) / previous.length
    const cpuChange = ((recentCpuAvg - previousCpuAvg) / previousCpuAvg) * 100

    trends.push({
      metric: "CPU Usage",
      direction: cpuChange > 5 ? "degrading" : cpuChange < -5 ? "improving" : "stable",
      changePercent: Math.abs(cpuChange),
      timeframe: "last 5 minutes",
    })

    // Analyze memory trend
    const recentMemoryAvg = recent.reduce((sum, m) => sum + m.memory.used / m.memory.total, 0) / recent.length
    const previousMemoryAvg = previous.reduce((sum, m) => sum + m.memory.used / m.memory.total, 0) / previous.length
    const memoryChange = ((recentMemoryAvg - previousMemoryAvg) / previousMemoryAvg) * 100

    trends.push({
      metric: "Memory Usage",
      direction: memoryChange > 5 ? "degrading" : memoryChange < -5 ? "improving" : "stable",
      changePercent: Math.abs(memoryChange),
      timeframe: "last 5 minutes",
    })

    // Analyze response time trend
    const recentResponseAvg = recent.reduce((sum, m) => sum + m.http.avgResponseTime, 0) / recent.length
    const previousResponseAvg = previous.reduce((sum, m) => sum + m.http.avgResponseTime, 0) / previous.length
    const responseChange = ((recentResponseAvg - previousResponseAvg) / previousResponseAvg) * 100

    trends.push({
      metric: "Response Time",
      direction: responseChange > 10 ? "degrading" : responseChange < -10 ? "improving" : "stable",
      changePercent: Math.abs(responseChange),
      timeframe: "last 5 minutes",
    })

    return trends
  }

  private calculateHealthScore(metrics: PerformanceMetrics, bottlenecks: BottleneckInfo[]): number {
    let score = 100

    // Deduct points for each bottleneck
    bottlenecks.forEach((bottleneck) => {
      switch (bottleneck.severity) {
        case "critical":
          score -= 30
          break
        case "high":
          score -= 20
          break
        case "medium":
          score -= 10
          break
        case "low":
          score -= 5
          break
      }
    })

    // Additional deductions for specific metrics
    if (metrics.http.errorRate > 0) {
      score -= metrics.http.errorRate * 2
    }

    if (metrics.database.slowQueries > 0) {
      score -= Math.min(metrics.database.slowQueries * 5, 20)
    }

    return Math.max(score, 0)
  }

  private identifyCriticalIssues(metrics: PerformanceMetrics, bottlenecks: BottleneckInfo[]): CriticalIssue[] {
    const issues: CriticalIssue[] = []

    bottlenecks.forEach((bottleneck, index) => {
      if (bottleneck.severity === "critical") {
        issues.push({
          id: `critical-${bottleneck.type}-${index}`,
          type: bottleneck.type,
          description: bottleneck.description,
          severity: 10,
          autoFixable: this.isAutoFixable(bottleneck.type),
          recommendation: this.getRecommendation(bottleneck),
        })
      }
    })

    return issues
  }

  private isAutoFixable(type: string): boolean {
    // Define which issues can be automatically fixed
    return ["memory", "database"].includes(type)
  }

  private getRecommendation(bottleneck: BottleneckInfo): string {
    switch (bottleneck.type) {
      case "cpu":
        return "Consider scaling horizontally or optimizing CPU-intensive operations"
      case "memory":
        return "Implement memory cleanup, optimize data structures, or increase memory allocation"
      case "database":
        return "Add database indexes, optimize queries, or implement connection pooling"
      case "http":
        return "Implement caching, optimize middleware, or add load balancing"
      case "eventloop":
        return "Optimize synchronous operations and move heavy tasks to worker threads"
      default:
        return "Monitor and investigate further"
    }
  }

  private detectRegression(history: PerformanceMetrics[]): boolean {
    if (history.length < 20) {
      return false
    }

    const recent = history.slice(-10)
    const baseline = history.slice(-20, -10)

    // Check for significant performance regression
    const recentAvgResponse = recent.reduce((sum, m) => sum + m.http.avgResponseTime, 0) / recent.length
    const baselineAvgResponse = baseline.reduce((sum, m) => sum + m.http.avgResponseTime, 0) / baseline.length

    const regressionThreshold = 0.5 // 50% increase
    return (recentAvgResponse - baselineAvgResponse) / baselineAvgResponse > regressionThreshold
  }

  async performDeepAnalysis(metrics: PerformanceMetrics[]): Promise<PerformanceAnalysis> {
    if (metrics.length === 0) {
      return {
        hasBottlenecks: false,
        bottlenecks: [],
        trends: [],
        healthScore: 100,
        criticalIssues: [],
        regressionDetected: false,
      }
    }

    const latest = metrics[metrics.length - 1]
    return this.analyzeMetrics(latest, metrics)
  }

  async generateReport(metrics: PerformanceMetrics[]): Promise<any> {
    const analysis = await this.performDeepAnalysis(metrics)

    return {
      summary: {
        healthScore: analysis.healthScore,
        totalBottlenecks: analysis.bottlenecks.length,
        criticalIssues: analysis.criticalIssues.length,
        regressionDetected: analysis.regressionDetected,
      },
      details: analysis,
      recommendations: analysis.criticalIssues.map((issue) => issue.recommendation),
      timestamp: new Date(),
    }
  }
}
