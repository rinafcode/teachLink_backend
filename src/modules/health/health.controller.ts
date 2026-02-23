import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';

interface ServiceStatus {
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  error?: string;
}

interface HealthReport {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
}

/**
 * #157 – HealthController
 *
 * GET /health  – full status report (database + Redis)
 * GET /health/live  – liveness probe (process is alive)
 * GET /health/ready – readiness probe (dependencies reachable)
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Full system health check' })
  @ApiResponse({ status: 200, description: 'System is healthy' })
  @ApiResponse({ status: 503, description: 'One or more services are unavailable' })
  async getHealth() {
    const [database, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allOk = database.status === 'ok' && redisStatus.status === 'ok';
    const anyDown = database.status === 'down' || redisStatus.status === 'down';

    const report: HealthReport = {
      status: allOk ? 'ok' : anyDown ? 'down' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version ?? '0.0.0',
      services: { database, redis: redisStatus },
    };

    return report;
  }

  /** Liveness: is the Node process alive and responding? */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  getLiveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Readiness: are all dependencies reachable? */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe' })
  async getReadiness() {
    const [database, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const ready = database.status === 'ok' && redisStatus.status === 'ok';

    return {
      ready,
      timestamp: new Date().toISOString(),
      services: { database, redis: redisStatus },
    };
  }

  // ─── Private checks ────────────────────────────────────────────────────────

  private async checkDatabase(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: process.env.NODE_ENV !== 'production'
          ? (err as Error).message
          : 'Database unreachable',
      };
    }
  }

  private async checkRedis(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      await this.redis.ping();
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: process.env.NODE_ENV !== 'production'
          ? (err as Error).message
          : 'Redis unreachable',
      };
    }
  }
}