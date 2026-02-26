import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  private redis: Redis;

  constructor(private readonly dataSource: DataSource) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    });
  }

  @Get()
  async checkHealth() {
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        redis: 'unknown',
      },
    };

    // 🔹 Database Check
    try {
      await this.dataSource.query('SELECT 1');
      healthStatus.services.database = 'up';
    } catch {
      healthStatus.services.database = 'down';
      healthStatus.status = 'degraded';
    }

    // 🔹 Redis Check
    try {
      const pong = await this.redis.ping();
      healthStatus.services.redis = pong === 'PONG' ? 'up' : 'down';

      if (pong !== 'PONG') {
        healthStatus.status = 'degraded';
      }
    } catch {
      healthStatus.services.redis = 'down';
      healthStatus.status = 'degraded';
    }

    return healthStatus;
  }
}