import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getSharedRedisClient } from '../config/cache.config';

export interface CacheMetrics {
  key: string;
  hits: number;
  misses: number;
  hitRate: number;
  avgTtl: number;
  lastAccessed: Date;
  accessFrequency: number; // accesses per hour
  dataSize: number; // bytes
  costScore: number; // computed cost-benefit score
}

export interface TTLRecommendation {
  key: string;
  currentTtl: number;
  recommendedTtl: number;
  reason: string;
  confidence: number; // 0-1
  potentialSavings: number; // estimated memory/compute savings
}

export interface CacheAnalyticsReport {
  totalKeys: number;
  overallHitRate: number;
  memoryUsage: number;
  topPerformers: CacheMetrics[];
  underPerformers: CacheMetrics[];
  ttlRecommendations: TTLRecommendation[];
  adaptiveTtlAdjustments: number;
  generatedAt: Date;
}

@Injectable()
export class CacheAnalyticsService {
  private readonly logger = new Logger(CacheAnalyticsService.name);
  private readonly redis: Redis;
  private readonly metricsKey = 'cache:analytics:metrics';
  private readonly configKey = 'cache:analytics:config';
  private readonly adaptiveTtlEnabled: boolean;
  private readonly minSampleSize: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.redis = getSharedRedisClient(configService);
    this.adaptiveTtlEnabled = configService.get<boolean>('CACHE_ADAPTIVE_TTL_ENABLED', true);
    this.minSampleSize = configService.get<number>('CACHE_MIN_SAMPLE_SIZE', 100);
  }

  /**
   * Record cache hit event
   */
  async recordHit(key: string, ttl?: number): Promise<void> {
    const timestamp = Date.now();
    const metrics = await this.getKeyMetrics(key);
    
    metrics.hits += 1;
    metrics.lastAccessed = new Date(timestamp);
    
    if (ttl) {
      metrics.avgTtl = (metrics.avgTtl * (metrics.hits - 1) + ttl) / metrics.hits;
    }

    await this.updateKeyMetrics(key, metrics);
    this.eventEmitter.emit('cache.hit', { key, timestamp, ttl });
  }

  /**
   * Record cache miss event
   */
  async recordMiss(key: string): Promise<void> {
    const timestamp = Date.now();
    const metrics = await this.getKeyMetrics(key);
    
    metrics.misses += 1;
    metrics.lastAccessed = new Date(timestamp);

    await this.updateKeyMetrics(key, metrics);
    this.eventEmitter.emit('cache.miss', { key, timestamp });
  }

  /**
   * Record cache set operation with data size
   */
  async recordSet(key: string, ttl: number, dataSize: number): Promise<void> {
    const timestamp = Date.now();
    const metrics = await this.getKeyMetrics(key);
    
    metrics.avgTtl = ttl;
    metrics.dataSize = dataSize;
    metrics.lastAccessed = new Date(timestamp);

    await this.updateKeyMetrics(key, metrics);
    this.eventEmitter.emit('cache.set', { key, ttl, dataSize, timestamp });
  }

  /**
   * Get metrics for a specific cache key
   */
  private async getKeyMetrics(key: string): Promise<CacheMetrics> {
    const metricsData = await this.redis.hget(this.metricsKey, key);
    
    if (metricsData) {
      return JSON.parse(metricsData);
    }

    return {
      key,
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgTtl: 0,
      lastAccessed: new Date(),
      accessFrequency: 0,
      dataSize: 0,
      costScore: 0,
    };
  }

  /**
   * Update metrics for a cache key
   */
  private async updateKeyMetrics(key: string, metrics: CacheMetrics): Promise<void> {
    // Calculate derived metrics
    const totalAccesses = metrics.hits + metrics.misses;
    metrics.hitRate = totalAccesses > 0 ? metrics.hits / totalAccesses : 0;
    
    // Calculate access frequency (accesses per hour)
    const hoursSinceLastAccess = (Date.now() - metrics.lastAccessed.getTime()) / (1000 * 60 * 60);
    metrics.accessFrequency = hoursSinceLastAccess > 0 ? totalAccesses / Math.max(hoursSinceLastAccess, 1) : totalAccesses;
    
    // Calculate cost-benefit score
    metrics.costScore = this.calculateCostScore(metrics);

    await this.redis.hset(this.metricsKey, key, JSON.stringify(metrics));
  }

  /**
   * Calculate cost-benefit score for cache optimization
   */
  private calculateCostScore(metrics: CacheMetrics): number {
    const { hitRate, accessFrequency, dataSize, avgTtl } = metrics;
    
    // Higher score = better cache candidate
    // Factors: hit rate (40%), access frequency (30%), data efficiency (20%), TTL efficiency (10%)
    const hitRateScore = hitRate * 0.4;
    const frequencyScore = Math.min(accessFrequency / 10, 1) * 0.3; // normalize to max 10 accesses/hour
    const sizeEfficiencyScore = Math.max(0, 1 - (dataSize / 1024 / 1024)) * 0.2; // penalize large objects
    const ttlEfficiencyScore = Math.min(avgTtl / 3600, 1) * 0.1; // normalize to max 1 hour
    
    return hitRateScore + frequencyScore + sizeEfficiencyScore + ttlEfficiencyScore;
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport(): Promise<CacheAnalyticsReport> {
    const allMetrics = await this.getAllMetrics();
    const totalKeys = allMetrics.length;
    
    // Calculate overall hit rate
    const totalHits = allMetrics.reduce((sum, m) => sum + m.hits, 0);
    const totalMisses = allMetrics.reduce((sum, m) => sum + m.misses, 0);
    const overallHitRate = (totalHits + totalMisses) > 0 ? totalHits / (totalHits + totalMisses) : 0;
    
    // Get memory usage
    const memoryUsage = await this.getMemoryUsage();
    
    // Sort by cost score
    const sortedMetrics = allMetrics.sort((a, b) => b.costScore - a.costScore);
    
    // Generate TTL recommendations
    const ttlRecommendations = await this.generateTTLRecommendations(allMetrics);
    
    return {
      totalKeys,
      overallHitRate,
      memoryUsage,
      topPerformers: sortedMetrics.slice(0, 10),
      underPerformers: sortedMetrics.slice(-10).reverse(),
      ttlRecommendations,
      adaptiveTtlAdjustments: await this.getAdaptiveTtlAdjustmentCount(),
      generatedAt: new Date(),
    };
  }

  /**
   * Generate TTL recommendations based on analytics
   */
  private async generateTTLRecommendations(metrics: CacheMetrics[]): Promise<TTLRecommendation[]> {
    const recommendations: TTLRecommendation[] = [];

    for (const metric of metrics) {
      if (metric.hits + metric.misses < this.minSampleSize) {
        continue; // Skip keys with insufficient data
      }

      const recommendation = this.calculateOptimalTTL(metric);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    return recommendations.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Calculate optimal TTL for a cache key
   */
  private calculateOptimalTTL(metrics: CacheMetrics): TTLRecommendation | null {
    const { key, hitRate, accessFrequency, avgTtl, dataSize } = metrics;
    
    let recommendedTtl = avgTtl;
    let reason = '';
    let confidence = 0;
    let potentialSavings = 0;

    // High hit rate + high frequency = increase TTL
    if (hitRate > 0.8 && accessFrequency > 5) {
      recommendedTtl = Math.min(avgTtl * 1.5, 3600); // max 1 hour
      reason = 'High hit rate and access frequency - increase TTL';
      confidence = 0.9;
      potentialSavings = dataSize * 0.3; // 30% memory savings from fewer fetches
    }
    // Low hit rate = decrease TTL
    else if (hitRate < 0.3) {
      recommendedTtl = Math.max(avgTtl * 0.5, 60); // min 1 minute
      reason = 'Low hit rate - decrease TTL to reduce memory waste';
      confidence = 0.8;
      potentialSavings = dataSize * 0.5; // 50% memory savings
    }
    // Low frequency = decrease TTL
    else if (accessFrequency < 1) {
      recommendedTtl = Math.max(avgTtl * 0.7, 60);
      reason = 'Low access frequency - decrease TTL';
      confidence = 0.7;
      potentialSavings = dataSize * 0.2;
    }
    // Large objects with moderate performance = decrease TTL
    else if (dataSize > 1024 * 1024 && hitRate < 0.6) { // > 1MB
      recommendedTtl = Math.max(avgTtl * 0.8, 120);
      reason = 'Large object with moderate hit rate - decrease TTL';
      confidence = 0.6;
      potentialSavings = dataSize * 0.4;
    }

    // Only return recommendation if there's a significant change
    if (Math.abs(recommendedTtl - avgTtl) / avgTtl > 0.2) {
      return {
        key,
        currentTtl: avgTtl,
        recommendedTtl: Math.round(recommendedTtl),
        reason,
        confidence,
        potentialSavings,
      };
    }

    return null;
  }

  /**
   * Apply adaptive TTL adjustments
   */
  @Cron(CronExpression.EVERY_HOUR)
  async applyAdaptiveTTLAdjustments(): Promise<void> {
    if (!this.adaptiveTtlEnabled) {
      return;
    }

    this.logger.log('Starting adaptive TTL adjustments');
    
    const metrics = await this.getAllMetrics();
    let adjustmentCount = 0;

    for (const metric of metrics) {
      if (metric.hits + metric.misses < this.minSampleSize) {
        continue;
      }

      const recommendation = this.calculateOptimalTTL(metric);
      if (recommendation && recommendation.confidence > 0.7) {
        await this.applyTTLAdjustment(recommendation);
        adjustmentCount++;
      }
    }

    await this.incrementAdaptiveTtlAdjustmentCount(adjustmentCount);
    this.logger.log(`Applied ${adjustmentCount} adaptive TTL adjustments`);
  }

  /**
   * Apply TTL adjustment to cache configuration
   */
  private async applyTTLAdjustment(recommendation: TTLRecommendation): Promise<void> {
    const configKey = `ttl:${recommendation.key}`;
    await this.redis.hset(this.configKey, configKey, recommendation.recommendedTtl);
    
    this.eventEmitter.emit('cache.ttl.adjusted', {
      key: recommendation.key,
      oldTtl: recommendation.currentTtl,
      newTtl: recommendation.recommendedTtl,
      reason: recommendation.reason,
      confidence: recommendation.confidence,
    });
  }

  /**
   * Get recommended TTL for a cache key
   */
  async getRecommendedTTL(key: string, defaultTtl: number): Promise<number> {
    const configKey = `ttl:${key}`;
    const recommendedTtl = await this.redis.hget(this.configKey, configKey);
    
    return recommendedTtl ? parseInt(recommendedTtl, 10) : defaultTtl;
  }

  /**
   * Get all cache metrics
   */
  private async getAllMetrics(): Promise<CacheMetrics[]> {
    const allMetricsData = await this.redis.hgetall(this.metricsKey);
    
    return Object.values(allMetricsData).map(data => JSON.parse(data));
  }

  /**
   * Get memory usage information
   */
  private async getMemoryUsage(): Promise<number> {
    try {
      const info = await this.redis.info('memory');
      // Parse used_memory from the info string
      const match = info.match(/used_memory:(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    } catch (error) {
      this.logger.warn('Could not get memory usage', error);
      return 0;
    }
  }

  /**
   * Get adaptive TTL adjustment count
   */
  private async getAdaptiveTtlAdjustmentCount(): Promise<number> {
    const count = await this.redis.get('cache:analytics:ttl_adjustments');
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Increment adaptive TTL adjustment count
   */
  private async incrementAdaptiveTtlAdjustmentCount(increment: number): Promise<void> {
    await this.redis.incrby('cache:analytics:ttl_adjustments', increment);
  }

  /**
   * Clean up old metrics data
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldMetrics(): Promise<void> {
    this.logger.log('Cleaning up old cache metrics');
    
    const allMetrics = await this.getAllMetrics();
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    let cleanedCount = 0;
    for (const metric of allMetrics) {
      if (metric.lastAccessed < cutoffDate && metric.hits + metric.misses < this.minSampleSize) {
        await this.redis.hdel(this.metricsKey, metric.key);
        cleanedCount++;
      }
    }

    this.logger.log(`Cleaned up ${cleanedCount} old cache metrics`);
  }

  /**
   * Event handlers for cache operations
   */
  @OnEvent('cache.get')
  async handleCacheGet(payload: { key: string; hit: boolean; ttl?: number }): Promise<void> {
    if (payload.hit) {
      await this.recordHit(payload.key, payload.ttl);
    } else {
      await this.recordMiss(payload.key);
    }
  }

  @OnEvent('cache.set')
  async handleCacheSet(payload: { key: string; ttl: number; size: number }): Promise<void> {
    await this.recordSet(payload.key, payload.ttl, payload.size);
  }
}