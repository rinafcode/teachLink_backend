import { Controller, Get, HttpStatus, OnModuleDestroy, Query, Res, UseGuards, } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { HealthService } from './health.service';
import { ShutdownStateService } from '../common/services/shutdown-state.service';
@SkipThrottle()
@ApiTags('health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('health')
export class HealthController implements OnModuleDestroy {
    private redis: Redis;
    constructor(private readonly dataSource: DataSource, private readonly healthService: HealthService, private readonly shutdownState: ShutdownStateService) {
        this.redis = new Redis({
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT),
        });
        this.redis.on('error', () => {
            // Health endpoint handles Redis failures explicitly in checkHealth.
        });
    }
  }

  @Get()
  @ApiResponse({ status: HttpStatus.OK, description: 'Health check response' })
  async checkHealth() {
    const healthStatus = await this.healthService.checkHealth(this.dataSource, this.redis);
    return healthStatus;
  }

  /**
   * Validates liveness.
   * @returns The operation result.
   */
  @Get('liveness')
  @ApiResponse({ status: HttpStatus.OK, description: 'Liveness check response' })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Application is shutting down',
  })
  checkLiveness(@Res() res: Response) {
    if (this.shutdownState.isShuttingDown()) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'shutting_down',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(HttpStatus.OK).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Validates readiness.
   * @returns The operation result.
   */
  @Get('readiness')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Readiness check response',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Application is shutting down',
  })
  async checkReadiness(@Res() res: Response) {
    if (this.shutdownState.isShuttingDown()) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'shutting_down',
        timestamp: new Date().toISOString(),
      });
    }

    const healthStatus = await this.healthService.checkReadiness(this.dataSource, this.redis);
    return res.status(HttpStatus.OK).json(healthStatus);
  }

  /**
   * Validates dependencies.
   * @param service The service.
   * @returns The operation result.
   */
  @Get('dependencies')
  async checkDependencies(@Query('service') service?: string) {
    const healthStatus = await this.healthService.checkHealth(this.dataSource, this.redis);

    if (service) {
      return {
        service,
        status: healthStatus.services[service] || 'unknown',
        details: healthStatus.details[service] || null,
        timestamp: healthStatus.timestamp,
      };
    }

    return {
      dependencies: healthStatus.services,
      details: healthStatus.details,
      timestamp: healthStatus.timestamp,
      overallStatus: healthStatus.status,
    };
  }

  /**
   * Validates database.
   * @returns The operation result.
   */
  @Get('database')
  async checkDatabase() {
    const healthStatus = await this.healthService.checkHealth(this.dataSource, this.redis);
    return {
      service: 'database',
      status: healthStatus.services.database,
      details: healthStatus.details.database,
      timestamp: healthStatus.timestamp,
    };
  }

  /**
   * Validates redis.
   * @returns The operation result.
   */
  @Get('redis')
  async checkRedis() {
    const healthStatus = await this.healthService.checkHealth(this.dataSource, this.redis);
    return {
      service: 'redis',
      status: healthStatus.services.redis,
      details: healthStatus.details.redis,
      timestamp: healthStatus.timestamp,
    };
  }

  /**
   * Validates queue.
   * @returns The operation result.
   */
  @Get('queue')
  async checkQueue() {
    const healthStatus = await this.healthService.checkHealth(this.dataSource, this.redis);
    return {
      service: 'queue',
      status: healthStatus.services.queue,
      details: healthStatus.details.queue,
      timestamp: healthStatus.timestamp,
    };
  }

  /**
   * Validates cache.
   * @returns The operation result.
   */
  @Get('cache')
  async checkCache() {
    const healthStatus = await this.healthService.checkHealth(this.dataSource, this.redis);
    return {
      service: 'cache',
      status: healthStatus.services.cache,
      details: healthStatus.details.cache,
      timestamp: healthStatus.timestamp,
    };
  }

  /**
   * Returns health Summary.
   * @returns The operation result.
   */
  @Get('summary')
  async getHealthSummary() {
    const healthStatus = await this.healthService.checkHealth(this.dataSource, this.redis);

    const serviceCount = Object.keys(healthStatus.services).length;
    const healthyCount = Object.values(healthStatus.services).filter(
      (status) => status === 'up',
    ).length;
    const degradedCount = Object.values(healthStatus.services).filter(
      (status) => status === 'degraded' || status === 'warning',
    ).length;
    const criticalCount = Object.values(healthStatus.services).filter(
      (status) => status === 'down' || status === 'critical',
    ).length;

    return {
      overall: healthStatus.status,
      timestamp: healthStatus.timestamp,
      uptime: healthStatus.uptime,
      version: healthStatus.version,
      environment: healthStatus.environment,
      summary: {
        total: serviceCount,
        healthy: healthyCount,
        degraded: degradedCount,
        critical: criticalCount,
        healthScore: Math.round((healthyCount / serviceCount) * 100),
      },
      services: healthStatus.services,
    };
  }
}
