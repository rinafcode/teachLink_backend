import {
  Controller,
  Get,
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
}
