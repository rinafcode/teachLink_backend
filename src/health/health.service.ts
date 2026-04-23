import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import * as fs from 'fs';
import axios from 'axios';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'critical';
  timestamp: string;
  uptime: number;
  services: {
    database: string;
    redis: string;
    externalApis: Record<string, string>;
    disk: string;
  };
  details?: {
    database?: {
      responseTime: number;
      connectionStatus: string;
    };
    redis?: {
      responseTime: number;
      connectionStatus: string;
    };
    disk?: {
      used: number;
      total: number;
      percentage: number;
    };
    externalApis?: Record<string, { status: string; responseTime: number; error?: string }>;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  // External API endpoints to check
  private readonly externalApiEndpoints = [
    { name: 'stripe', url: process.env.STRIPE_HEALTH_URL, key: 'STRIPE_SECRET_KEY' },
    { name: 'sendgrid', url: process.env.SENDGRID_HEALTH_URL, key: 'SENDGRID_API_KEY' },
    { name: 'aws', url: process.env.AWS_HEALTH_URL, key: 'AWS_ACCESS_KEY_ID' },
  ];

  // Disk space thresholds
  private readonly diskWarningThreshold = 85; // 85%
  private readonly diskCriticalThreshold = 95; // 95%

  async checkHealth(dataSource: DataSource, redis: Redis): Promise<HealthStatus> {
    const healthStatus: HealthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      services: {
        database: 'unknown',
        redis: 'unknown',
        externalApis: {},
        disk: 'unknown',
      },
      details: {},
    };

    // Check database
    const dbCheck = await this.checkDatabase(dataSource);
    healthStatus.services.database = dbCheck.status;
    healthStatus.details.database = {
      responseTime: dbCheck.responseTime,
      connectionStatus: dbCheck.status,
    };
    if (dbCheck.status === 'down') {
      healthStatus.status = 'degraded';
    }

    // Check Redis
    const redisCheck = await this.checkRedis(redis);
    healthStatus.services.redis = redisCheck.status;
    healthStatus.details.redis = {
      responseTime: redisCheck.responseTime,
      connectionStatus: redisCheck.status,
    };
    if (redisCheck.status === 'down') {
      healthStatus.status = 'degraded';
    }

    // Check external APIs
    const apiChecks = await this.checkExternalApis();
    healthStatus.services.externalApis = {};
    for (const [apiName, check] of Object.entries(apiChecks)) {
      healthStatus.services.externalApis[apiName] = check.status;
    }
    healthStatus.details.externalApis = apiChecks;

    // Check if any external API is down
    const anyApiDown = Object.values(apiChecks).some((check) => check.status === 'down');
    if (anyApiDown && healthStatus.status === 'ok') {
      healthStatus.status = 'degraded';
    }

    // Check disk space
    const diskCheck = await this.checkDiskSpace();
    healthStatus.services.disk = diskCheck.status;
    healthStatus.details.disk = {
      used: diskCheck.used,
      total: diskCheck.total,
      percentage: diskCheck.percentage,
    };
    if (diskCheck.status === 'critical') {
      healthStatus.status = 'critical';
    } else if (diskCheck.status === 'warning' && healthStatus.status === 'ok') {
      healthStatus.status = 'degraded';
    }

    return healthStatus;
  }

  async checkReadiness(dataSource: DataSource, redis: Redis): Promise<HealthStatus> {
    // For readiness, we check if core dependencies are available
    const healthStatus: HealthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      services: {
        database: 'unknown',
        redis: 'unknown',
        externalApis: {},
        disk: 'unknown',
      },
    };

    try {
      const dbCheck = await this.checkDatabase(dataSource);
      healthStatus.services.database = dbCheck.status;
      if (dbCheck.status === 'down') {
        healthStatus.status = 'critical';
      }
    } catch {
      healthStatus.services.database = 'down';
      healthStatus.status = 'critical';
    }

    try {
      const redisCheck = await this.checkRedis(redis);
      healthStatus.services.redis = redisCheck.status;
      if (redisCheck.status === 'down') {
        healthStatus.status = 'critical';
      }
    } catch {
      healthStatus.services.redis = 'down';
      healthStatus.status = 'critical';
    }

    return healthStatus;
  }

  private async checkDatabase(dataSource: DataSource): Promise<{
    status: string;
    responseTime: number;
  }> {
    const startTime = Date.now();
    try {
      await dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      return {
        status: responseTime < 1000 ? 'up' : 'degraded',
        responseTime,
      };
    } catch (error) {
      this.logger.error(`Database health check failed: ${error.message}`);
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
      };
    }
  }

  private async checkRedis(redis: Redis): Promise<{
    status: string;
    responseTime: number;
  }> {
    const startTime = Date.now();
    try {
      const pong = await (redis as any).ping();
      const responseTime = Date.now() - startTime;
      return {
        status: pong === 'PONG' && responseTime < 500 ? 'up' : 'degraded',
        responseTime,
      };
    } catch (error) {
      this.logger.error(`Redis health check failed: ${error.message}`);
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
      };
    }
  }

  private async checkExternalApis(): Promise<
    Record<string, { status: string; responseTime: number; error?: string }>
  > {
    const results: Record<string, { status: string; responseTime: number; error?: string }> = {};

    for (const endpoint of this.externalApiEndpoints) {
      // Skip if API key is not configured
      if (!process.env[endpoint.key]) {
        results[endpoint.name] = {
          status: 'not_configured',
          responseTime: 0,
        };
        continue;
      }

      // Skip if URL is not configured
      if (!endpoint.url) {
        results[endpoint.name] = {
          status: 'not_configured',
          responseTime: 0,
        };
        continue;
      }

      const startTime = Date.now();
      try {
        const response = await axios.get(endpoint.url, {
          timeout: 5000,
          validateStatus: (status) => status < 500,
        });
        const responseTime = Date.now() - startTime;
        results[endpoint.name] = {
          status: response.status < 400 ? 'up' : 'down',
          responseTime,
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        this.logger.warn(`External API health check failed for ${endpoint.name}: ${error.message}`);
        results[endpoint.name] = {
          status: 'down',
          responseTime,
          error: error.message,
        };
      }
    }

    return results;
  }

  private async checkDiskSpace(): Promise<{
    status: string;
    used: number;
    total: number;
    percentage: number;
  }> {
    try {
      // Get disk space using Node.js fs module
      const stats = await fs.promises.statfs(process.cwd());
      const total = stats.bsize * stats.blocks;
      const free = stats.bsize * stats.bfree;
      const used = total - free;
      const percentage = Math.round((used / total) * 100);

      let status = 'up';
      if (percentage >= this.diskCriticalThreshold) {
        status = 'critical';
      } else if (percentage >= this.diskWarningThreshold) {
        status = 'warning';
      }

      return {
        status,
        used,
        total,
        percentage,
      };
    } catch (error) {
      this.logger.error(`Disk space check failed: ${error.message}`);
      return {
        status: 'unknown',
        used: 0,
        total: 0,
        percentage: 0,
      };
    }
  }
}
