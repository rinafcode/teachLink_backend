import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject, Optional, } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, from } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';
import { CachingService } from '../caching.service';
import { CacheAnalyticsService } from '../analytics/cache-analytics.service';
import {
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
  CACHE_EVICT_METADATA,
  CACHE_PREFIX_METADATA,
  CACHE_CONDITION_METADATA,
  ICacheEvictOptions,
} from '../decorators/cache.decorator';
import { CACHE_TTL } from '../caching.constants';

export interface ICacheInterceptorOptions {
  /**
   * Default TTL in seconds
   */
  defaultTtl?: number;

  /**
   * Default key prefix
   */
  defaultPrefix?: string;

  /**
   * Methods to cache (default: GET)
   */
  methods?: string[];

  /**
   * Whether to track analytics
   */
  trackAnalytics?: boolean;
}

/**
 * Intercepts cache request handling.
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly defaultTtl: number;
  private readonly defaultPrefix: string;
  private readonly cachedMethods: string[];
  private readonly trackAnalytics: boolean;

  constructor(
    private readonly cachingService: CachingService,
    private readonly reflector: Reflector,
    @Optional() @Inject('CACHE_INTERCEPTOR_OPTIONS') options?: ICacheInterceptorOptions,
    @Optional() private readonly analyticsService?: CacheAnalyticsService,
  ) {
    this.defaultTtl = options?.defaultTtl ?? CACHE_TTL.COURSE_DETAILS;
    this.defaultPrefix = options?.defaultPrefix ?? 'cache:http';
    this.cachedMethods = options?.methods ?? ['GET'];
    this.trackAnalytics = options?.trackAnalytics ?? true;
  }

  /**
   * Executes intercept.
   * @param context The context.
   * @param next The next.
   * @returns The resulting observable<any>.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Only cache specified HTTP methods
    if (!request || !this.cachedMethods.includes(request.method)) {
      return next.handle();
    }

    // Get metadata from decorator
    const handler = context.getHandler();
    const ttl = this.reflector.get<number>(CACHE_TTL_METADATA, handler) ?? this.defaultTtl;
    const prefix = this.reflector.get<string>(CACHE_PREFIX_METADATA, handler) ?? this.defaultPrefix;
    const customKey = this.reflector.get<string | ((...args: any[]) => string)>(
      CACHE_KEY_METADATA,
      handler,
    );
    const evictOptions = this.reflector.get<ICacheEvictOptions>(CACHE_EVICT_METADATA, handler);
    const condition = this.reflector.get<(...args: any[]) => boolean>(
      CACHE_CONDITION_METADATA,
      handler,
    );

    // Generate cache key
    const cacheKey = this.generateCacheKey(request, prefix, customKey);

    // Handle cache eviction
    if (evictOptions) {
      return this.handleEviction(next, evictOptions, cacheKey);
    }

    // Check condition
    if (condition && !condition(request.params, request.query, request.body)) {
      return next.handle();
    }

    // Try to get from cache
    return from(this.cachingService.get(cacheKey)).pipe(
      mergeMap((cachedResponse) => {
        if (cachedResponse !== null) {
          // Cache hit
          if (this.trackAnalytics && this.analyticsService) {
            this.analyticsService.recordHit(cacheKey);
          }
          return of(cachedResponse);
        }
        // Get metadata from decorator
        const handler = context.getHandler();
        const ttl = this.reflector.get<number>(CACHE_TTL_METADATA, handler) ?? this.defaultTtl;
        const prefix = this.reflector.get<string>(CACHE_PREFIX_METADATA, handler) ?? this.defaultPrefix;
        const customKey = this.reflector.get<string | ((...args: unknown[]) => string)>(CACHE_KEY_METADATA, handler);
        const evictOptions = this.reflector.get<CacheEvictOptions>(CACHE_EVICT_METADATA, handler);
        const condition = this.reflector.get<(...args: unknown[]) => boolean>(CACHE_CONDITION_METADATA, handler);
        // Generate cache key
        const cacheKey = this.generateCacheKey(request, prefix, customKey);
        // Handle cache eviction
        if (evictOptions) {
            return this.handleEviction(next, evictOptions, cacheKey);
        }
        // Check condition
        if (condition && !condition(request.params, request.query, request.body)) {
            return next.handle();
        }
        // Try to get from cache
        return from(this.cachingService.get(cacheKey)).pipe(mergeMap((cachedResponse) => {
            if (cachedResponse !== null) {
                // Cache hit
                if (this.trackAnalytics && this.analyticsService) {
                    this.analyticsService.recordHit(cacheKey);
                }
                return of(cachedResponse);
            }
            // Cache miss - execute handler and cache result
            return next.handle().pipe(tap({
                next: (response) => {
                    // Cache the response
                    if (this.trackAnalytics && this.analyticsService) {
                        this.analyticsService.recordMiss(cacheKey);
                    }
                    from(this.cachingService.set(cacheKey, response, ttl)).subscribe();
                },
            }));
        }));
    }
    /**
     * Handle cache eviction before or after method execution
     */
    private handleEviction(next: CallHandler, evictOptions: CacheEvictOptions, _currentKey: string): Observable<unknown> {
        const patterns = Array.isArray(evictOptions.patterns)
            ? evictOptions.patterns
            : [evictOptions.patterns];
        if (evictOptions.beforeInvocation) {
            // Evict before method execution
            return from(this.evictPatterns(patterns)).pipe(mergeMap(() => next.handle()));
        }
        // Evict after successful method execution
        return next.handle().pipe(tap({
            next: () => {
                from(this.evictPatterns(patterns)).subscribe();
            },
          }),
        );
      }),
    );
  }

  /**
   * Handle cache eviction before or after method execution
   */
  private handleEviction(
    next: CallHandler,
    evictOptions: ICacheEvictOptions,
    _currentKey: string,
  ): Observable<any> {
    const patterns = Array.isArray(evictOptions.patterns)
      ? evictOptions.patterns
      : [evictOptions.patterns];

    if (evictOptions.beforeInvocation) {
      // Evict before method execution
      return from(this.evictPatterns(patterns)).pipe(mergeMap(() => next.handle()));
    }
    /**
     * Evict cache entries matching patterns
     */
    private async evictPatterns(patterns: string[]): Promise<void> {
        for (const pattern of patterns) {
            await this.cachingService.delPattern(pattern);
        }
    }
    /**
     * Generate a cache key from request
     */
    private generateCacheKey(request: unknown, prefix: string, customKey?: string | ((...args: unknown[]) => string)): string {
        if (customKey) {
            if (typeof customKey === 'function') {
                return customKey(request.params, request.query, request.body);
            }
            return customKey;
        }
        const route = request.route?.path ?? request.url;
        const params = JSON.stringify(request.params ?? {});
        const query = JSON.stringify(request.query ?? {});
        const userId = request.user?.id ?? 'anonymous';
        // Create a hash-like key from route, params, query, and user
        const keyParts = [prefix, route.replace(/\//g, ':'), userId, this.hashString(params + query)];
        return keyParts.filter(Boolean).join(':');
    }
    /**
     * Simple string hash for cache key generation
     */
    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
}
/**
 * Factory function to create a configured cache interceptor
 */
export function createCacheInterceptor(
  cachingService: CachingService,
  reflector: Reflector,
  options?: ICacheInterceptorOptions,
  analyticsService?: CacheAnalyticsService,
): CacheInterceptor {
  return new CacheInterceptor(cachingService, reflector, options, analyticsService);
}
