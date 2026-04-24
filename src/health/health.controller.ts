
import {
  Controller,
  Get,
  Query,
  HttpStatus,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  UseGuards,VERSION_NEUTRAL,
 Version 
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';
import { HealthStatus } from './health.service';

@Version(VERSION_NEUTRAL)
@SkipThrottle()
@ApiTags('health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('health')
export class HealthController {
  private redis: Redis;

  constructor(
    private readonly dataSource: DataSource,
    private readonly healthService: HealthService,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    });

    this.redis.on('error', () => {
      // Health endpoint handles Redis failures explicitly in checkHealth.
    });
  }

  @Get()
  @ApiResponse({ status: HttpStatus.OK, description: 'Health check response', type: HealthStatus })
  async checkHealth() {
    const healthStatus = await this.healthService.checkHealth(this.dataSource, this.redis);
    return healthStatus;
  }

  @Get('liveness')
  @ApiResponse({ status: HttpStatus.OK, description: 'Liveness check response' })
  async checkLiveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('readiness')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Readiness check response',
    type: HealthStatus,
  })
  async checkReadiness() {
    const healthStatus = await this.healthService.checkReadiness(this.dataSource, this.redis);
    return healthStatus;
  }

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

  @Get('summary')
  async getHealthSummary() {
    const healthStatus = await this.healthService.checkHealth(this.dataSource, this.redis);

    const serviceCount = Object.keys(healthStatus.services).length;
    const healthyCount = Object.values(healthStatus.services).filter(status => status === 'up').length;
    const degradedCount = Object.values(healthStatus.services).filter(status => status === 'degraded' || status === 'warning').length;
    const criticalCount = Object.values(healthStatus.services).filter(status => status === 'down' || status === 'critical').length;

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
