import { Injectable, Logger } from "@nestjs/common"
import type { DataSource } from "typeorm"
import * as os from "os"
import * as process from "process"
import { performance, PerformanceObserver } from "perf_hooks"
import type { PerformanceMetrics } from "../monitoring.service"

interface HttpMetrics {
  requestCount: number
  totalResponseTime: number
  errorCount: number
  lastMinuteRequests: number[]
}

@Injectable()
export class MetricsCollectionService {
  private readonly logger = new Logger(MetricsCollectionService.name)
  private httpMetrics: HttpMetrics = {
    requestCount: 0,
    totalResponseTime: 0,
    errorCount: 0,
    lastMinuteRequests: [],
  }
  private eventLoopDelay = 0
  private performanceObserver: PerformanceObserver
  private dataSource: DataSource

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource
    this.setupPerformanceObserver()
    this.setupEventLoopMonitoring()
    this.logger.log("Metrics collection service initialized")
  }

  private setupPerformanceObserver() {
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      for (const entry of entries) {
        if (entry.entryType === "measure") {
          // Track custom performance measurements
          this.logger.debug(`Performance measure: ${entry.name} - ${entry.duration}ms`)
        }
      }
    })

    this.performanceObserver.observe({ entryTypes: ["measure", "resource"] })
  }

  private setupEventLoopMonitoring() {
    const { monitorEventLoopDelay } = require("perf_hooks")
    const histogram = monitorEventLoopDelay({ resolution: 20 })
    histogram.enable()

    setInterval(() => {
      this.eventLoopDelay = histogram.mean / 1000000 
      histogram.reset()
    }, 1000)
  }

  async collectAllMetrics(): Promise<PerformanceMetrics> {
    const [cpuMetrics, memoryMetrics, dbMetrics, httpMetrics] = await Promise.all([
      this.collectCpuMetrics(),
      this.collectMemoryMetrics(),
      this.collectDatabaseMetrics(),
      this.collectHttpMetrics(),
    ])

    return {
      timestamp: new Date(),
      cpu: cpuMetrics,
      memory: memoryMetrics,
      database: dbMetrics,
      http: httpMetrics,
      eventLoop: {
        delay: this.eventLoopDelay,
        utilization: this.calculateEventLoopUtilization(),
      },
    }
  }

  private async collectCpuMetrics() {
    const cpus = os.cpus()
    const loadAvg = os.loadavg()

    // Calculate CPU usage
    let totalIdle = 0
    let totalTick = 0

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type]
      }
      totalIdle += cpu.times.idle
    })

    const usage = 100 - ~~((100 * totalIdle) / totalTick)

    return {
      usage,
      loadAverage: loadAvg,
    }
  }

  private async collectMemoryMetrics() {
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
    }

    const processMemory = process.memoryUsage()

    return {
      ...systemMemory,
      heapUsed: processMemory.heapUsed,
      heapTotal: processMemory.heapTotal,
    }
  }

  private async collectDatabaseMetrics() {
    try {
      // Get active connections
      const connectionCount = await this.dataSource.query(
        "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = $1",
        ["active"],
      )

      // Get slow queries (queries taking more than 1 second)
      const slowQueries = await this.dataSource.query(`
        SELECT count(*) as slow_queries 
        FROM pg_stat_statements 
        WHERE mean_exec_time > 1000
      `)

      // Get average query time
      const avgQueryTime = await this.dataSource.query(`
        SELECT avg(mean_exec_time) as avg_time 
        FROM pg_stat_statements 
        WHERE calls > 0
      `)

      return {
        activeConnections: Number.parseInt(connectionCount[0]?.active_connections || "0"),
        slowQueries: Number.parseInt(slowQueries[0]?.slow_queries || "0"),
        avgQueryTime: Number.parseFloat(avgQueryTime[0]?.avg_time || "0"),
      }
    } catch (error) {
      this.logger.warn("Could not collect database metrics", error.message)
      return {
        activeConnections: 0,
        slowQueries: 0,
        avgQueryTime: 0,
      }
    }
  }

  private async collectHttpMetrics() {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    // Filter requests from the last minute
    this.httpMetrics.lastMinuteRequests = this.httpMetrics.lastMinuteRequests.filter(
      (timestamp) => timestamp > oneMinuteAgo,
    )

    const requestsPerSecond = this.httpMetrics.lastMinuteRequests.length / 60
    const avgResponseTime =
      this.httpMetrics.requestCount > 0 ? this.httpMetrics.totalResponseTime / this.httpMetrics.requestCount : 0
    const errorRate =
      this.httpMetrics.requestCount > 0 ? (this.httpMetrics.errorCount / this.httpMetrics.requestCount) * 100 : 0

    return {
      requestsPerSecond,
      avgResponseTime,
      errorRate,
    }
  }

  private calculateEventLoopUtilization(): number {
    // Simplified event loop utilization calculation
    // In a real implementation, you might use more sophisticated methods
    return Math.min(this.eventLoopDelay / 10, 100) 
  }

  // Methods to be called by HTTP interceptors
  recordHttpRequest(responseTime: number, isError = false) {
    this.httpMetrics.requestCount++
    this.httpMetrics.totalResponseTime += responseTime
    this.httpMetrics.lastMinuteRequests.push(Date.now())

    if (isError) {
      this.httpMetrics.errorCount++
    }
  }

  // Method to record custom performance measurements
  recordCustomMetric(name: string, value: number) {
    performance.mark(`${name}-start`)
    setTimeout(() => {
      performance.mark(`${name}-end`)
      performance.measure(name, `${name}-start`, `${name}-end`)
    }, value)
  }
}
