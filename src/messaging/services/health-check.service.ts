import { Injectable, Logger } from "@nestjs/common"
import axios from "axios"

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name)

  async checkServiceHealth(url: string, timeout = 5000): Promise<boolean> {
    try {
      const response = await axios.get(url, {
        timeout,
        validateStatus: (status) => status < 500, // Accept 2xx, 3xx, 4xx as healthy
      })

      return response.status < 500
    } catch (error) {
      this.logger.debug(`Health check failed for ${url}: ${error.message}`)
      return false
    }
  }

  async checkDatabaseHealth(connectionString: string): Promise<boolean> {
    // Implementation would depend on database type
    // This is a placeholder
    return true
  }

  async checkRedisHealth(host: string, port: number): Promise<boolean> {
    // Implementation would check Redis connectivity
    // This is a placeholder
    return true
  }

  async performComprehensiveHealthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy"
    checks: Record<string, { status: boolean; responseTime: number; error?: string }>
  }> {
    const checks: Record<string, { status: boolean; responseTime: number; error?: string }> = {}

    // Check database
    const dbStart = Date.now()
    try {
      const dbHealthy = await this.checkDatabaseHealth(process.env.DATABASE_URL || "")
      checks.database = {
        status: dbHealthy,
        responseTime: Date.now() - dbStart,
      }
    } catch (error) {
      checks.database = {
        status: false,
        responseTime: Date.now() - dbStart,
        error: error.message,
      }
    }

    // Check Redis
    const redisStart = Date.now()
    try {
      const redisHealthy = await this.checkRedisHealth(
        process.env.REDIS_HOST || "localhost",
        Number.parseInt(process.env.REDIS_PORT) || 6379,
      )
      checks.redis = {
        status: redisHealthy,
        responseTime: Date.now() - redisStart,
      }
    } catch (error) {
      checks.redis = {
        status: false,
        responseTime: Date.now() - redisStart,
        error: error.message,
      }
    }

    // Determine overall status
    const allChecks = Object.values(checks)
    const healthyChecks = allChecks.filter((check) => check.status).length
    const totalChecks = allChecks.length

    let status: "healthy" | "degraded" | "unhealthy"
    if (healthyChecks === totalChecks) {
      status = "healthy"
    } else if (healthyChecks > totalChecks / 2) {
      status = "degraded"
    } else {
      status = "unhealthy"
    }

    return { status, checks }
  }
}
