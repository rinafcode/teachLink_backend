import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getSharedRedisClient } from '../config/cache.config';

export type ServiceStatus = 'healthy' | 'unhealthy';

export interface ServiceHealth {
  status: ServiceStatus;
  latencyMs?: number;
  message?: string;
}

export interface AggregatedHealth {
  status: ServiceStatus;
  checkedAt: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    externalApis: ServiceHealth;
  };
}

@Injectable()
export class HealthAggregationService {
  private readonly logger = new Logger(HealthAggregationService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async aggregate(): Promise<AggregatedHealth> {
    const [database, redis, externalApis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkExternalApis(),
    ]);

    const allHealthy = [database, redis, externalApis].every(s => s.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checkedAt: new Date().toISOString(),
      services: { database, redis, externalApis },
    };
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      this.logger.warn(`DB health check failed: ${(err as Error).message}`);
      return { status: 'unhealthy', message: (err as Error).message };
    }
  }

  private async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const client = getSharedRedisClient();
      await client.ping();
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      this.logger.warn(`Redis health check failed: ${(err as Error).message}`);
      return { status: 'unhealthy', message: (err as Error).message };
    }
  }

  private async checkExternalApis(): Promise<ServiceHealth> {
    // Placeholder — extend with real external service probes as needed
    return { status: 'healthy', message: 'No external services configured' };
  }
}