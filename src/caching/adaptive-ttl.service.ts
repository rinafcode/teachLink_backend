import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getSharedRedisClient } from '../config/cache.config';

export interface AdaptiveTTLRule {
  keyPattern: string;
  minTtl: number;
  maxTtl: number;
  hitRateThreshold: number;
  accessFrequencyThreshold: number;
  adjustmentFactor: number;
  enabled: boolean;
}

export interface TTLAdjustmentEvent {
  key: string;
  oldTtl: number;
  newTtl: number;
  reason: string;
  hitRate: number;
  accessFrequency: number;
  timestamp: Date;
}

@Injectable()
export class AdaptiveTTLService {
  private readonly logger = new Logger(AdaptiveTTLService.name);
  private readonly redis: Redis;
  private readonly rulesKey = 'cache:adaptive_ttl:rules';
  private readonly adjustmentsKey = 'cache:adaptive_ttl:adjustments';
  private readonly defaultRules: AdaptiveTTLRule[];

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.redis = getSharedRedisClient(configService);
    this.defaultRules = this.initializeDefaultRules();
    this.initializeRules();
  }

  /**
   * Initialize default adaptive TTL rules
   */
  private initializeDefaultRules(): AdaptiveTTLRule[] {
    return [
      {
        keyPattern: 'cache:user:profile:*',
        minTtl: 300, // 5 minutes
        maxTtl: 3600, // 1 hour
        hitRateThreshold: 0.7,
        accessFrequencyThreshold: 2, // accesses per hour
        adjustmentFactor: 1.2,
        enabled: true,
      },
      {
        keyPattern: 'cache:course:*',
        minTtl: 180, // 3 minutes
        maxTtl: 1800, // 30 minutes
        hitRateThreshold: 0.6,
        accessFrequencyThreshold: 5,
        adjustmentFactor: 1.3,
        enabled: true,
      },
      {
        keyPattern: 'cache:search:*',
        minTtl: 60, // 1 minute
        maxTtl: 600, // 10 minutes
        hitRateThreshold: 0.5,
        accessFrequencyThreshold: 10,
        adjustmentFactor: 1.5,
        enabled: true,
      },
      {
        keyPattern: 'cache:popular:*',
        minTtl: 600, // 10 minutes
        maxTtl: 7200, // 2 hours
        hitRateThreshold: 0.8,
        accessFrequencyThreshold: 1,
        adjustmentFactor: 1.1,
        enabled: true,
      },
      {
        keyPattern: 'cache:enrollment:*',
        minTtl: 120, // 2 minutes
        maxTtl: 900, // 15 minutes
        hitRateThreshold: 0.6,
        accessFrequencyThreshold: 3,
        adjustmentFactor: 1.25,
        enabled: true,
      },
    ];
  }

  /**
   * Initialize rules in Redis if they don't exist
   */
  private async initializeRules(): Promise<void> {
    const existingRules = await this.redis.get(this.rulesKey);
    
    if (!existingRules) {
      await this.redis.set(this.rulesKey, JSON.stringify(this.defaultRules));
      this.logger.log('Initialized default adaptive TTL rules');
    }
  }

  /**
   * Get adaptive TTL for a cache key
   */
  async getAdaptiveTTL(
    key: string, 
    defaultTtl: number, 
    hitRate?: number, 
    accessFrequency?: number
  ): Promise<number> {
    const rule = await this.findMatchingRule(key);
    
    if (!rule || !rule.enabled) {
      return defaultTtl;
    }

    // If we don't have metrics, return default within rule bounds
    if (hitRate === undefined || accessFrequency === undefined) {
      return Math.max(rule.minTtl, Math.min(defaultTtl, rule.maxTtl));
    }

    let adjustedTtl = defaultTtl;

    // Increase TTL for high-performing keys
    if (hitRate >= rule.hitRateThreshold && accessFrequency >= rule.accessFrequencyThreshold) {
      adjustedTtl = Math.min(defaultTtl * rule.adjustmentFactor, rule.maxTtl);
    }
    // Decrease TTL for low-performing keys
    else if (hitRate < rule.hitRateThreshold * 0.7) {
      adjustedTtl = Math.max(defaultTtl / rule.adjustmentFactor, rule.minTtl);
    }
    // Decrease TTL for infrequently accessed keys
    else if (accessFrequency < rule.accessFrequencyThreshold * 0.5) {
      adjustedTtl = Math.max(defaultTtl * 0.8, rule.minTtl);
    }

    // Ensure TTL is within rule bounds
    adjustedTtl = Math.max(rule.minTtl, Math.min(adjustedTtl, rule.maxTtl));

    // Log adjustment if significant
    if (Math.abs(adjustedTtl - defaultTtl) / defaultTtl > 0.1) {
      this.logger.debug(
        `Adaptive TTL adjustment for ${key}: ${defaultTtl}s -> ${adjustedTtl}s ` +
        `(hit rate: ${hitRate?.toFixed(2)}, frequency: ${accessFrequency?.toFixed(2)})`
      );

      // Record the adjustment
      await this.recordAdjustment({
        key,
        oldTtl: defaultTtl,
        newTtl: adjustedTtl,
        reason: this.getAdjustmentReason(hitRate, accessFrequency, rule),
        hitRate,
        accessFrequency,
        timestamp: new Date(),
      });
    }

    return Math.round(adjustedTtl);
  }

  /**
   * Find matching rule for a cache key
   */
  private async findMatchingRule(key: string): Promise<AdaptiveTTLRule | null> {
    const rulesData = await this.redis.get(this.rulesKey);
    
    if (!rulesData) {
      return null;
    }

    const rules: AdaptiveTTLRule[] = JSON.parse(rulesData);
    
    return rules.find(rule => this.matchesPattern(key, rule.keyPattern)) || null;
  }

  /**
   * Check if a key matches a pattern
   */
  private matchesPattern(key: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }

  /**
   * Get reason for TTL adjustment
   */
  private getAdjustmentReason(
    hitRate: number, 
    accessFrequency: number, 
    rule: AdaptiveTTLRule
  ): string {
    if (hitRate >= rule.hitRateThreshold && accessFrequency >= rule.accessFrequencyThreshold) {
      return 'High hit rate and access frequency - increased TTL';
    }
    if (hitRate < rule.hitRateThreshold * 0.7) {
      return 'Low hit rate - decreased TTL';
    }
    if (accessFrequency < rule.accessFrequencyThreshold * 0.5) {
      return 'Low access frequency - decreased TTL';
    }
    return 'Adaptive adjustment based on performance metrics';
  }

  /**
   * Record TTL adjustment for analytics
   */
  private async recordAdjustment(adjustment: TTLAdjustmentEvent): Promise<void> {
    const adjustmentData = JSON.stringify(adjustment);
    const timestamp = adjustment.timestamp.getTime();
    
    // Store with timestamp as score for time-based queries
    await this.redis.zadd(this.adjustmentsKey, timestamp, adjustmentData);
    
    // Keep only last 1000 adjustments
    await this.redis.zremrangebyrank(this.adjustmentsKey, 0, -1001);
    
    // Emit event for real-time monitoring
    this.eventEmitter.emit('cache.ttl.adjusted', adjustment);
  }

  /**
   * Get recent TTL adjustments
   */
  async getRecentAdjustments(limit: number = 50): Promise<TTLAdjustmentEvent[]> {
    const adjustments = await this.redis.zrevrange(this.adjustmentsKey, 0, limit - 1);
    
    return adjustments.map(data => JSON.parse(data));
  }

  /**
   * Get TTL adjustment statistics
   */
  async getAdjustmentStats(hours: number = 24): Promise<{
    totalAdjustments: number;
    increasedTtl: number;
    decreasedTtl: number;
    averageAdjustment: number;
    topAdjustedKeys: string[];
  }> {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const adjustments = await this.redis.zrangebyscore(this.adjustmentsKey, since, '+inf');
    
    const parsed = adjustments.map(data => JSON.parse(data) as TTLAdjustmentEvent);
    
    const increased = parsed.filter(adj => adj.newTtl > adj.oldTtl).length;
    const decreased = parsed.filter(adj => adj.newTtl < adj.oldTtl).length;
    
    const adjustmentRatios = parsed.map(adj => adj.newTtl / adj.oldTtl);
    const averageAdjustment = adjustmentRatios.length > 0 
      ? adjustmentRatios.reduce((sum, ratio) => sum + ratio, 0) / adjustmentRatios.length 
      : 1;

    // Count adjustments per key
    const keyAdjustments = new Map<string, number>();
    parsed.forEach(adj => {
      keyAdjustments.set(adj.key, (keyAdjustments.get(adj.key) || 0) + 1);
    });

    const topAdjustedKeys = Array.from(keyAdjustments.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key]) => key);

    return {
      totalAdjustments: parsed.length,
      increasedTtl: increased,
      decreasedTtl: decreased,
      averageAdjustment,
      topAdjustedKeys,
    };
  }

  /**
   * Get all adaptive TTL rules
   */
  async getRules(): Promise<AdaptiveTTLRule[]> {
    const rulesData = await this.redis.get(this.rulesKey);
    return rulesData ? JSON.parse(rulesData) : this.defaultRules;
  }

  /**
   * Update adaptive TTL rules
   */
  async updateRules(rules: AdaptiveTTLRule[]): Promise<void> {
    await this.redis.set(this.rulesKey, JSON.stringify(rules));
    this.logger.log('Updated adaptive TTL rules');
    this.eventEmitter.emit('cache.adaptive_ttl.rules_updated', rules);
  }

  /**
   * Add or update a specific rule
   */
  async updateRule(rule: AdaptiveTTLRule): Promise<void> {
    const rules = await this.getRules();
    const existingIndex = rules.findIndex(r => r.keyPattern === rule.keyPattern);
    
    if (existingIndex >= 0) {
      rules[existingIndex] = rule;
    } else {
      rules.push(rule);
    }
    
    await this.updateRules(rules);
  }

  /**
   * Remove a rule by key pattern
   */
  async removeRule(keyPattern: string): Promise<void> {
    const rules = await this.getRules();
    const filteredRules = rules.filter(r => r.keyPattern !== keyPattern);
    
    if (filteredRules.length !== rules.length) {
      await this.updateRules(filteredRules);
      this.logger.log(`Removed adaptive TTL rule for pattern: ${keyPattern}`);
    }
  }

  /**
   * Enable or disable a rule
   */
  async toggleRule(keyPattern: string, enabled: boolean): Promise<void> {
    const rules = await this.getRules();
    const rule = rules.find(r => r.keyPattern === keyPattern);
    
    if (rule) {
      rule.enabled = enabled;
      await this.updateRules(rules);
      this.logger.log(`${enabled ? 'Enabled' : 'Disabled'} adaptive TTL rule for pattern: ${keyPattern}`);
    }
  }

  /**
   * Clean up old adjustment records
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldAdjustments(): Promise<void> {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
    const removed = await this.redis.zremrangebyscore(this.adjustmentsKey, '-inf', cutoff);
    
    if (removed > 0) {
      this.logger.log(`Cleaned up ${removed} old TTL adjustment records`);
    }
  }

  /**
   * Event handler for cache operations to trigger adaptive adjustments
   */
  @OnEvent('cache.performance.analyzed')
  async handlePerformanceAnalysis(payload: {
    key: string;
    hitRate: number;
    accessFrequency: number;
    currentTtl: number;
  }): Promise<void> {
    const adaptiveTtl = await this.getAdaptiveTTL(
      payload.key,
      payload.currentTtl,
      payload.hitRate,
      payload.accessFrequency
    );

    if (adaptiveTtl !== payload.currentTtl) {
      this.eventEmitter.emit('cache.ttl.recommendation', {
        key: payload.key,
        currentTtl: payload.currentTtl,
        recommendedTtl: adaptiveTtl,
        reason: this.getAdjustmentReason(
          payload.hitRate,
          payload.accessFrequency,
          await this.findMatchingRule(payload.key) || this.defaultRules[0]
        ),
      });
    }
  }
}