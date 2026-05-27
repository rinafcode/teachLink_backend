import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { CacheAnalyticsService, CacheAnalyticsReport, TTLRecommendation } from './cache-analytics.service';
import { CACHE_TTL, CACHE_PREFIXES } from './caching.constants';

export interface CacheOptimizationConfig {
  enableAdaptiveTtl: boolean;
  enableHitRateOptimization: boolean;
  enableMemoryOptimization: boolean;
  minHitRateThreshold: number;
  maxMemoryUsageThreshold: number;
  optimizationInterval: number; // minutes
}

export interface OptimizationResult {
  optimizationsApplied: number;
  memoryFreed: number;
  hitRateImprovement: number;
  recommendations: TTLRecommendation[];
  timestamp: Date;
}

@Injectable()
export class CacheOptimizationService {
  private readonly logger = new Logger(CacheOptimizationService.name);
  private readonly config: CacheOptimizationConfig;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly analyticsService: CacheAnalyticsService,
  ) {
    this.config = {
      enableAdaptiveTtl: configService.get<boolean>('CACHE_ADAPTIVE_TTL_ENABLED', true),
      enableHitRateOptimization: configService.get<boolean>('CACHE_HIT_RATE_OPTIMIZATION_ENABLED', true),
      enableMemoryOptimization: configService.get<boolean>('CACHE_MEMORY_OPTIMIZATION_ENABLED', true),
      minHitRateThreshold: configService.get<number>('CACHE_MIN_HIT_RATE_THRESHOLD', 0.6),
      maxMemoryUsageThreshold: configService.get<number>('CACHE_MAX_MEMORY_THRESHOLD', 0.8),
      optimizationInterval: configService.get<number>('CACHE_OPTIMIZATION_INTERVAL_MINUTES', 60),
    };
  }

  /**
   * Enhanced cache get with analytics tracking
   */
  async get<T>(key: string, defaultTtl?: number): Promise<T | undefined> {
    const startTime = Date.now();
    
    try {
      const value = await this.cacheManager.get<T>(key);
      const hit = value !== undefined;
      
      // Get TTL for analytics
      const ttl = hit ? await this.getTTL(key) : undefined;
      
      // Record analytics
      this.eventEmitter.emit('cache.get', { key, hit, ttl });
      
      // Track performance
      const duration = Date.now() - startTime;
      this.eventEmitter.emit('cache.performance', { 
        operation: 'get', 
        key, 
        duration, 
        hit 
      });

      return value;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      this.eventEmitter.emit('cache.error', { operation: 'get', key, error });
      return undefined;
    }
  }

  /**
   * Enhanced cache set with adaptive TTL and analytics
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Get recommended TTL if adaptive TTL is enabled
      const finalTtl = this.config.enableAdaptiveTtl && ttl
        ? await this.analyticsService.getRecommendedTTL(key, ttl)
        : ttl || this.getDefaultTTL(key);

      await this.cacheManager.set(key, value, finalTtl * 1000); // Convert to milliseconds
      
      // Calculate data size for analytics
      const dataSize = this.calculateDataSize(value);
      
      // Record analytics
      this.eventEmitter.emit('cache.set', { key, ttl: finalTtl, size: dataSize });
      
      // Track performance
      const duration = Date.now() - startTime;
      this.eventEmitter.emit('cache.performance', { 
        operation: 'set', 
        key, 
        duration, 
        size: dataSize 
      });

    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      this.eventEmitter.emit('cache.error', { operation: 'set', key, error });
    }
  }

  /**
   * Enhanced cache delete with analytics
   */
  async del(key: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.cacheManager.del(key);
      
      this.eventEmitter.emit('cache.delete', { key });
      
      const duration = Date.now() - startTime;
      this.eventEmitter.emit('cache.performance', { 
        operation: 'delete', 
        key, 
        duration 
      });

    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
      this.eventEmitter.emit('cache.error', { operation: 'delete', key, error });
    }
  }

  /**
   * Run comprehensive cache optimization
   */
  async optimizeCache(): Promise<OptimizationResult> {
    this.logger.log('Starting cache optimization process');
    
    const report = await this.analyticsService.generateAnalyticsReport();
    let optimizationsApplied = 0;
    let memoryFreed = 0;
    let hitRateImprovement = 0;

    // Apply TTL optimizations
    if (this.config.enableAdaptiveTtl) {
      const ttlOptimizations = await this.applyTTLOptimizations(report.ttlRecommendations);
      optimizationsApplied += ttlOptimizations.count;
      memoryFreed += ttlOptimizations.memoryFreed;
    }

    // Apply hit rate optimizations
    if (this.config.enableHitRateOptimization) {
      const hitRateOptimizations = await this.applyHitRateOptimizations(report);
      optimizationsApplied += hitRateOptimizations.count;
      hitRateImprovement += hitRateOptimizations.improvement;
    }

    // Apply memory optimizations
    if (this.config.enableMemoryOptimization) {
      const memoryOptimizations = await this.applyMemoryOptimizations(report);
      optimizationsApplied += memoryOptimizations.count;
      memoryFreed += memoryOptimizations.memoryFreed;
    }

    const result: OptimizationResult = {
      optimizationsApplied,
      memoryFreed,
      hitRateImprovement,
      recommendations: report.ttlRecommendations,
      timestamp: new Date(),
    };

    this.eventEmitter.emit('cache.optimization.completed', result);
    this.logger.log(`Cache optimization completed: ${optimizationsApplied} optimizations applied`);

    return result;
  }

  /**
   * Apply TTL optimizations based on recommendations
   */
  private async applyTTLOptimizations(recommendations: TTLRecommendation[]): Promise<{ count: number; memoryFreed: number }> {
    let count = 0;
    let memoryFreed = 0;

    for (const recommendation of recommendations) {
      if (recommendation.confidence > 0.7) {
        // Apply the TTL recommendation
        await this.updateTTLConfiguration(recommendation.key, recommendation.recommendedTtl);
        count++;
        memoryFreed += recommendation.potentialSavings;
        
        this.logger.debug(`Applied TTL optimization for ${recommendation.key}: ${recommendation.currentTtl}s -> ${recommendation.recommendedTtl}s`);
      }
    }

    return { count, memoryFreed };
  }

  /**
   * Apply hit rate optimizations
   */
  private async applyHitRateOptimizations(report: CacheAnalyticsReport): Promise<{ count: number; improvement: number }> {
    let count = 0;
    let improvement = 0;

    // Identify keys with low hit rates
    const lowHitRateKeys = report.underPerformers.filter(
      metric => metric.hitRate < this.config.minHitRateThreshold
    );

    for (const metric of lowHitRateKeys) {
      // Strategy 1: Reduce TTL for low-performing keys
      if (metric.avgTtl > 300) { // More than 5 minutes
        const newTtl = Math.max(metric.avgTtl * 0.5, 60);
        await this.updateTTLConfiguration(metric.key, newTtl);
        count++;
        improvement += 0.1; // Estimated improvement
        
        this.logger.debug(`Reduced TTL for low hit rate key ${metric.key}: ${metric.avgTtl}s -> ${newTtl}s`);
      }

      // Strategy 2: Mark for potential removal if extremely low hit rate
      if (metric.hitRate < 0.1 && metric.accessFrequency < 0.5) {
        await this.scheduleKeyForRemoval(metric.key);
        count++;
        improvement += 0.05;
      }
    }

    return { count, improvement };
  }

  /**
   * Apply memory optimizations
   */
  private async applyMemoryOptimizations(report: CacheAnalyticsReport): Promise<{ count: number; memoryFreed: number }> {
    let count = 0;
    let memoryFreed = 0;

    // Remove large, low-performing keys
    const largeLowPerformingKeys = report.underPerformers.filter(
      metric => metric.dataSize > 1024 * 1024 && metric.hitRate < 0.3 // > 1MB and < 30% hit rate
    );

    for (const metric of largeLowPerformingKeys) {
      await this.del(metric.key);
      count++;
      memoryFreed += metric.dataSize;
      
      this.logger.debug(`Removed large low-performing key ${metric.key}: ${metric.dataSize} bytes freed`);
    }

    return { count, memoryFreed };
  }

  /**
   * Update TTL configuration for a key
   */
  private async updateTTLConfiguration(key: string, newTtl: number): Promise<void> {
    // This would typically update a configuration store or database
    // For now, we'll emit an event that other services can listen to
    this.eventEmitter.emit('cache.ttl.updated', { key, ttl: newTtl });
  }

  /**
   * Schedule a key for removal
   */
  private async scheduleKeyForRemoval(key: string): Promise<void> {
    // Schedule for removal after a grace period
    setTimeout(async () => {
      await this.del(key);
      this.logger.debug(`Removed scheduled key: ${key}`);
    }, 60000); // 1 minute grace period
  }

  /**
   * Get default TTL for a cache key based on its prefix
   */
  private getDefaultTTL(key: string): number {
    // Match key prefix to determine appropriate TTL
    if (key.startsWith(CACHE_PREFIXES.USER_PROFILE)) {
      return CACHE_TTL.USER_PROFILE;
    }
    if (key.startsWith(CACHE_PREFIXES.COURSE)) {
      return CACHE_TTL.COURSE_DETAILS;
    }
    if (key.startsWith(CACHE_PREFIXES.SEARCH)) {
      return CACHE_TTL.SEARCH_RESULTS;
    }
    if (key.startsWith(CACHE_PREFIXES.POPULAR)) {
      return CACHE_TTL.POPULAR_COURSES;
    }
    if (key.startsWith(CACHE_PREFIXES.ENROLLMENT)) {
      return CACHE_TTL.ENROLLMENT_DATA;
    }
    
    // Default fallback
    return CACHE_TTL.COURSE_DETAILS; // 5 minutes
  }

  /**
   * Get TTL for a specific key
   */
  private async getTTL(key: string): Promise<number | undefined> {
    try {
      // This is a simplified implementation
      // In a real Redis setup, you'd use TTL command
      return undefined; // cache-manager doesn't expose TTL easily
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Calculate approximate data size
   */
  private calculateDataSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 0;
    }
  }

  /**
   * Get cache optimization configuration
   */
  getOptimizationConfig(): CacheOptimizationConfig {
    return { ...this.config };
  }

  /**
   * Update cache optimization configuration
   */
  updateOptimizationConfig(updates: Partial<CacheOptimizationConfig>): void {
    Object.assign(this.config, updates);
    this.eventEmitter.emit('cache.config.updated', this.config);
    this.logger.log('Cache optimization configuration updated');
  }
}