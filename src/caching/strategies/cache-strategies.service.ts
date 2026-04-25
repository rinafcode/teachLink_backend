import { Injectable } from '@nestjs/common';
import { CACHE_TTL, CACHE_PREFIXES, CACHE_EVENTS } from '../caching.constants';
export interface CacheStrategy {
    ttl: number;
    prefix: string;
    invalidateOn: string[];
}
export interface CacheStrategyConfig {
    name: string;
    ttl: number;
    prefix: string;
    invalidateOnEvents: string[];
    relatedPatterns: string[];
}
@Injectable()
export class CacheStrategiesService {
    private readonly strategies: Map<string, CacheStrategyConfig> = new Map();
    constructor() {
        this.initializeStrategies();
    }
    private initializeStrategies(): void {
        // Course strategies
        this.registerStrategy({
            name: 'course:details',
            ttl: CACHE_TTL.COURSE_DETAILS,
            prefix: CACHE_PREFIXES.COURSE,
            invalidateOnEvents: [CACHE_EVENTS.COURSE_UPDATED, CACHE_EVENTS.COURSE_DELETED],
            relatedPatterns: ['cache:course:*', 'cache:courses:list:*'],
        });
        this.registerStrategy({
            name: 'course:metadata',
            ttl: CACHE_TTL.COURSE_METADATA,
            prefix: CACHE_PREFIXES.COURSE,
            invalidateOnEvents: [CACHE_EVENTS.COURSE_UPDATED],
            relatedPatterns: ['cache:course:*'],
        });
        this.registerStrategy({
            name: 'courses:list',
            ttl: CACHE_TTL.COURSE_METADATA,
            prefix: CACHE_PREFIXES.COURSES_LIST,
            invalidateOnEvents: [
                CACHE_EVENTS.COURSE_UPDATED,
                CACHE_EVENTS.COURSE_DELETED,
                CACHE_EVENTS.ENROLLMENT_CREATED,
            ],
            relatedPatterns: ['cache:courses:list:*'],
        });
        // User strategies
        this.registerStrategy({
            name: 'user:profile',
            ttl: CACHE_TTL.USER_PROFILE,
            prefix: CACHE_PREFIXES.USER_PROFILE,
            invalidateOnEvents: [CACHE_EVENTS.USER_UPDATED, CACHE_EVENTS.USER_DELETED],
            relatedPatterns: ['cache:user:*', 'cache:user:profile:*'],
        });
        this.registerStrategy({
            name: 'user:session',
            ttl: CACHE_TTL.USER_SESSION,
            prefix: CACHE_PREFIXES.USER,
            invalidateOnEvents: [CACHE_EVENTS.USER_DELETED],
            relatedPatterns: ['cache:user:*'],
        });
        // Search strategies
        this.registerStrategy({
            name: 'search:results',
            ttl: CACHE_TTL.SEARCH_RESULTS,
            prefix: CACHE_PREFIXES.SEARCH,
            invalidateOnEvents: [
                CACHE_EVENTS.COURSE_UPDATED,
                CACHE_EVENTS.COURSE_DELETED,
                CACHE_EVENTS.SEARCH_INDEX_UPDATED,
            ],
            relatedPatterns: ['cache:search:*'],
        });
        // Popular content
        this.registerStrategy({
            name: 'popular:courses',
            ttl: CACHE_TTL.POPULAR_COURSES,
            prefix: CACHE_PREFIXES.POPULAR,
            invalidateOnEvents: [CACHE_EVENTS.COURSE_UPDATED, CACHE_EVENTS.ENROLLMENT_CREATED],
            relatedPatterns: ['cache:popular:*'],
        });
        // Enrollment strategies
        this.registerStrategy({
            name: 'enrollment:data',
            ttl: CACHE_TTL.ENROLLMENT_DATA,
            prefix: CACHE_PREFIXES.ENROLLMENT,
            invalidateOnEvents: [CACHE_EVENTS.ENROLLMENT_CREATED, CACHE_EVENTS.ENROLLMENT_UPDATED],
            relatedPatterns: ['cache:enrollment:*'],
        });
        // Featured content
        this.registerStrategy({
            name: 'featured:content',
            ttl: CACHE_TTL.STATIC_CONTENT,
            prefix: CACHE_PREFIXES.FEATURED,
            invalidateOnEvents: [CACHE_EVENTS.COURSE_UPDATED],
            relatedPatterns: ['cache:featured:*'],
        });
    }
    /**
     * Register a new cache strategy
     */
    registerStrategy(config: CacheStrategyConfig): void {
        this.strategies.set(config.name, config);
    }
    /**
     * Get a strategy by name
     */
    getStrategy(name: string): CacheStrategyConfig | undefined {
        return this.strategies.get(name);
    }
    /**
     * Get TTL for a strategy
     */
    getTtl(strategyName: string): number {
        const strategy = this.strategies.get(strategyName);
        return strategy?.ttl ?? CACHE_TTL.COURSE_DETAILS;
    }
    /**
     * Get prefix for a strategy
     */
    getPrefix(strategyName: string): string {
        const strategy = this.strategies.get(strategyName);
        return strategy?.prefix ?? 'cache';
    }
    /**
     * Get invalidation events for a strategy
     */
    getInvalidationEvents(strategyName: string): string[] {
        const strategy = this.strategies.get(strategyName);
        return strategy?.invalidateOnEvents ?? [];
    }
    /**
     * Get related patterns to invalidate when a strategy is invalidated
     */
    getRelatedPatterns(strategyName: string): string[] {
        const strategy = this.strategies.get(strategyName);
        return strategy?.relatedPatterns ?? [];
    }
    /**
     * Get all strategies that should be invalidated for a given event
     */
    getStrategiesForEvent(eventName: string): CacheStrategyConfig[] {
        const strategies: CacheStrategyConfig[] = [];
        for (const strategy of this.strategies.values()) {
            if (strategy.invalidateOnEvents.includes(eventName)) {
                strategies.push(strategy);
            }
        }
        return strategies;
    }
    /**
     * Get all patterns to invalidate for a given event
     */
    getPatternsForEvent(eventName: string): string[] {
        const strategies = this.getStrategiesForEvent(eventName);
        const patterns = new Set<string>();
        for (const strategy of strategies) {
            for (const pattern of strategy.relatedPatterns) {
                patterns.add(pattern);
            }
        }
        return Array.from(patterns);
    }
    /**
     * Get all registered strategies
     */
    getAllStrategies(): CacheStrategyConfig[] {
        return Array.from(this.strategies.values());
    }
    /**
     * Build a cache key for a strategy
     */
    buildKey(strategyName: string, ...parts: Array<string | number>): string {
        const prefix = this.getPrefix(strategyName);
        return `${prefix}:${parts.join(':')}`;
    }
    /**
     * Get default strategy configuration
     */
    getDefaultStrategy(): CacheStrategyConfig {
        return {
            name: 'default',
            ttl: CACHE_TTL.COURSE_DETAILS,
            prefix: 'cache',
            invalidateOnEvents: [],
            relatedPatterns: ['cache:*'],
        };
    }
}
