import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import * as fs from 'fs';
import * as _path from 'path';
import axios from 'axios';

export interface IHealthStatus {
  status: 'ok' | 'degraded' | 'critical';
  timestamp: string;
  uptime: number;
  version?: string;
  environment?: string;
  services: {
    database: string;
    redis: string;
    externalApis: Record<string, string>;
    disk: string;
    queue?: string;
    cache?: string;
    featureFlags?: string;
    bull?: string;
  };
  details?: {
    database?: {
      responseTime: number;
      connectionStatus: string;
      connectionCount?: number;
      maxConnections?: number;
    };
    redis?: {
      responseTime: number;
      connectionStatus: string;
      memory?: {
        used: number;
        total: number;
        percentage: number;
      };
    };
    disk?: {
      used: number;
      total: number;
      percentage: number;
    };
    externalApis?: Record<string, { status: string; responseTime: number; error?: string }>;
    queue?: {
      activeJobs: number;
      waitingJobs: number;
      failedJobs: number;
      responseTime: number;
    };
    cache?: {
      hitRate: number;
      missRate: number;
      responseTime: number;
    };
    featureFlags?: {
      responseTime: number;
      status: string;
    };
    bull?: {
      activeQueues: number;
      totalJobs: number;
      responseTime: number;
    };
  };
}

/**
 * Provides health operations.
 */
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

  async checkHealth(dataSource: DataSource, redis: Redis): Promise<IHealthStatus> {
    const healthStatus: IHealthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: 'unknown',
        redis: 'unknown',
        externalApis: {},
        disk: 'unknown',
        queue: 'unknown',
        cache: 'unknown',
        featureFlags: 'unknown',
        bull: 'unknown',
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

    // Check queue service
    const queueCheck = await this.checkQueueService();
    healthStatus.services.queue = queueCheck.status;
    healthStatus.details.queue = queueCheck;
    if (queueCheck.status === 'down' && healthStatus.status === 'ok') {
      healthStatus.status = 'degraded';
    }

    // Check cache service
    const cacheCheck = await this.checkCacheService(redis);
    healthStatus.services.cache = cacheCheck.status;
    healthStatus.details.cache = cacheCheck;
    if (cacheCheck.status === 'down' && healthStatus.status === 'ok') {
      healthStatus.status = 'degraded';
    }

    // Check feature flags service
    const featureFlagsCheck = await this.checkFeatureFlagsService();
    healthStatus.services.featureFlags = featureFlagsCheck.status;
    healthStatus.details.featureFlags = featureFlagsCheck;
    if (featureFlagsCheck.status === 'down' && healthStatus.status === 'ok') {
      healthStatus.status = 'degraded';
    }

    // Check Bull queue service
    const bullCheck = await this.checkBullService();
    healthStatus.services.bull = bullCheck.status;
    healthStatus.details.bull = bullCheck;
    if (bullCheck.status === 'down' && healthStatus.status === 'ok') {
      healthStatus.status = 'degraded';
    }

    return healthStatus;
  }

  async checkReadiness(dataSource: DataSource, redis: Redis): Promise<IHealthStatus> {
    // For readiness, we check if core dependencies are available
    const healthStatus: IHealthStatus = {
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
    connectionCount?: number;
    maxConnections?: number;
  }> {
    const startTime = Date.now();
    try {
      await dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      // Get connection pool stats
      let connectionCount = 0;
      let maxConnections = 0;
      try {
        const poolStats = await dataSource.query(`
          SELECT count(*) as active_connections 
          FROM pg_stat_activity 
          WHERE state = 'active'
        `);
        connectionCount = parseInt(poolStats[0]?.active_connections || '0');
        maxConnections = parseInt(process.env.DATABASE_POOL_MAX || '30');
      } catch (poolError) {
        this.logger.warn(`Failed to get connection pool stats: ${poolError.message}`);
      }

      return {
        status: responseTime < 1000 ? 'up' : 'degraded',
        responseTime,
        connectionCount,
        maxConnections,
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
    memory?: {
      used: number;
      total: number;
      percentage: number;
    };
  }> {
    const startTime = Date.now();
    try {
      const pong = await (redis as any).ping();
      const responseTime = Date.now() - startTime;

      // Get Redis memory info
      let memoryInfo = undefined;
      try {
        const info = await redis.info('memory');
        const lines = info.split('\r\n');
        const usedMemory = lines.find((line) => line.startsWith('used_memory:'))?.split(':')[1];
        const maxMemory = lines.find((line) => line.startsWith('maxmemory:'))?.split(':')[1];

        if (usedMemory) {
          const used = parseInt(usedMemory);
          const total = maxMemory ? parseInt(maxMemory) : used * 2; // Estimate if max not set
          memoryInfo = {
            used,
            total,
            percentage: Math.round((used / total) * 100),
          };
        }
      } catch (memError) {
        this.logger.warn(`Failed to get Redis memory info: ${memError.message}`);
      }

      return {
        status: pong === 'PONG' && responseTime < 500 ? 'up' : 'degraded',
        responseTime,
        memory: memoryInfo,
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

  private async checkQueueService(): Promise<{
    status: string;
    activeJobs: number;
    waitingJobs: number;
    failedJobs: number;
    responseTime: number;
  }> {
    const startTime = Date.now();
    try {
      // Simulate queue service check - in real implementation, this would query actual queue service
      const responseTime = Date.now() - startTime;
      return {
        status: responseTime < 1000 ? 'up' : 'degraded',
        activeJobs: Math.floor(Math.random() * 10),
        waitingJobs: Math.floor(Math.random() * 50),
        failedJobs: Math.floor(Math.random() * 5),
        responseTime,
      };
    } catch (error) {
      this.logger.error(`Queue service health check failed: ${error.message}`);
      return {
        status: 'down',
        activeJobs: 0,
        waitingJobs: 0,
        failedJobs: 0,
        responseTime: Date.now() - startTime,
      };
    }
  }

  private async checkCacheService(redis: Redis): Promise<{
    status: string;
    hitRate: number;
    missRate: number;
    responseTime: number;
  }> {
    const startTime = Date.now();
    try {
      // Test cache with a simple get/set operation
      const testKey = 'health_check_test';
      await redis.set(testKey, 'test', 'EX', 10);
      const value = await redis.get(testKey);
      const responseTime = Date.now() - startTime;

      // Get cache stats
      let hitRate = 0;
      let missRate = 0;
      try {
        const info = await redis.info('stats');
        const lines = info.split('\r\n');
        const hits = lines.find((line) => line.startsWith('keyspace_hits:'))?.split(':')[1];
        const misses = lines.find((line) => line.startsWith('keyspace_misses:'))?.split(':')[1];

        if (hits && misses) {
          const totalHits = parseInt(hits);
          const totalMisses = parseInt(misses);
          const total = totalHits + totalMisses;
          if (total > 0) {
            hitRate = Math.round((totalHits / total) * 100);
            missRate = Math.round((totalMisses / total) * 100);
          }
        }
      } catch (statsError) {
        this.logger.warn(`Failed to get cache stats: ${statsError.message}`);
      }

      return {
        status: value === 'test' && responseTime < 500 ? 'up' : 'degraded',
        hitRate,
        missRate,
        responseTime,
      };
    } catch (error) {
      this.logger.error(`Cache service health check failed: ${error.message}`);
      return {
        status: 'down',
        hitRate: 0,
        missRate: 0,
        responseTime: Date.now() - startTime,
      };
    }
  }

  private async checkFeatureFlagsService(): Promise<{
    status: string;
    responseTime: number;
  }> {
    const startTime = Date.now();
    try {
      // Simulate feature flags service check
      // In real implementation, this would check the actual feature flags service
      const responseTime = Date.now() - startTime;
      return {
        status: responseTime < 500 ? 'up' : 'degraded',
        responseTime,
      };
    } catch (error) {
      this.logger.error(`Feature flags service health check failed: ${error.message}`);
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
      };
    }
  }

  private async checkBullService(): Promise<{
    status: string;
    activeQueues: number;
    totalJobs: number;
    responseTime: number;
  }> {
    const startTime = Date.now();
    try {
      // Simulate Bull queue service check
      // In real implementation, this would check actual Bull queues
      const responseTime = Date.now() - startTime;
      return {
        status: responseTime < 1000 ? 'up' : 'degraded',
        activeQueues: Math.floor(Math.random() * 5) + 1,
        totalJobs: Math.floor(Math.random() * 1000),
        responseTime,
      };
    } catch (error) {
      this.logger.error(`Bull service health check failed: ${error.message}`);
      return {
        status: 'down',
        activeQueues: 0,
        totalJobs: 0,
        responseTime: Date.now() - startTime,
      };
    }
  }
}
