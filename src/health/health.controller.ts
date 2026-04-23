import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';


@Version(VERSION_NEUTRAL)
@SkipThrottle()
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
  async checkHealth() {
    const healthStatus = await this.healthService.checkHealth(this.dataSource, this.redis);
    return healthStatus;
  }

  @Get('liveness')
  async checkLiveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('readiness')
  async checkReadiness() {
    const healthStatus = await this.healthService.checkReadiness(this.dataSource, this.redis);
    return healthStatus;
  }
}
