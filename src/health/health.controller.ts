import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { HealthService } from './health.service';

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
