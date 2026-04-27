import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';
export const CACHE_EVICT_METADATA = 'cache:evict';
export const CACHE_PREFIX_METADATA = 'cache:prefix';
export const CACHE_CONDITION_METADATA = 'cache:condition';

/**
 * Options for cacheable decorator
 */
export interface ICacheableOptions {
  /**
   * Time to live in seconds
   */
  ttl?: number;

  /**
   * Cache key prefix
   */
  prefix?: string;

  /**
   * Custom cache key generator
   * If provided, this function will be used to generate the cache key
   */
  keyGenerator?: (...args: any[]) => string;

  /**
   * Condition to determine if result should be cached
   * Return true to cache, false to skip caching
   */
  condition?: (...args: any[]) => boolean;
}

/**
 * Options for cache evict decorator
 */
export interface ICacheEvictOptions {
  /**
   * Pattern(s) to evict (supports wildcards)
   */
  patterns: string | string[];

  /**
   * Whether to evict before method execution
   * Default: false (evict after successful execution)
   */
  beforeInvocation?: boolean;
}

/**
 * Decorator to cache method result
 *
 * @param ttl - Time to live in seconds
 * @param prefix - Optional key prefix
 *
 * @example
 * ```typescript
 * @Cacheable(300) // 5 minute TTL
 * async findOne(id: string) {
 *   return this.repository.findOne(id);
 * }
 *
 * @Cacheable({ ttl: 600, prefix: 'users' })
 * async getUserProfile(id: string) {
 *   return this.userRepository.findOne(id);
 * }
 * ```
 */
export function Cacheable(ttlOrOptions?: number | ICacheableOptions): MethodDecorator {
  const options: ICacheableOptions =
    typeof ttlOrOptions === 'number' ? { ttl: ttlOrOptions } : (ttlOrOptions ?? {});

  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) => {
    if (options.ttl) {
      SetMetadata(CACHE_TTL_METADATA, options.ttl)(target, propertyKey, descriptor);
    }

    if (options.prefix) {
      SetMetadata(CACHE_PREFIX_METADATA, options.prefix)(target, propertyKey, descriptor);
    }

    if (options.keyGenerator) {
      SetMetadata(CACHE_KEY_METADATA, options.keyGenerator)(target, propertyKey, descriptor);
    }

    if (options.condition) {
      SetMetadata(CACHE_CONDITION_METADATA, options.condition)(target, propertyKey, descriptor);
    }

    return descriptor;
  };
}

/**
 * Decorator to evict cache entries when method is executed
 *
 * @param patterns - Pattern(s) to evict (supports wildcards like 'cache:course:*')
 *
 * @example
 * ```typescript
 * @CacheEvict('cache:course:*')
 * async update(id: string, dto: UpdateCourseDto) {
 *   return this.repository.update(id, dto);
 * }
 *
 * @CacheEvict({ patterns: ['cache:user:*', 'cache:profile:*'], beforeInvocation: true })
 * async deleteUser(id: string) {
 *   await this.repository.delete(id);
 * }
 * ```
 */
export function CacheEvict(
  patternsOrOptions: string | string[] | ICacheEvictOptions,
): MethodDecorator {
  const options: ICacheEvictOptions =
    typeof patternsOrOptions === 'string'
      ? { patterns: [patternsOrOptions] }
      : Array.isArray(patternsOrOptions)
        ? { patterns: patternsOrOptions }
        : patternsOrOptions;

  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) => {
    SetMetadata(CACHE_EVICT_METADATA, options)(target, propertyKey, descriptor);
    return descriptor;
  };
}

/**
 * Decorator to set a custom cache key for a method
 *
 * @param key - Custom cache key or key generator function
 *
 * @example
 * ```typescript
 * @CacheKey('featured-courses')
 * @Cacheable(3600)
 * async getFeaturedCourses() {
 *   return this.repository.findFeatured();
 * }
 *
 * @CacheKey((args) => `user:${args[0]}:profile`)
 * @Cacheable(600)
 * async getUserProfile(userId: string) {
 *   return this.userRepository.findOne(userId);
 * }
 * ```
 */
export function CacheKey(key: string | ((...args: any[]) => string)): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) => {
    SetMetadata(CACHE_KEY_METADATA, key)(target, propertyKey, descriptor);
    return descriptor;
  };
}

/**
 * Decorator to set TTL for a cached method
 *
 * @param ttl - Time to live in seconds
 *
 * @example
 * ```typescript
 * @CacheTTL(3600) // 1 hour
 * @Cacheable()
 * async getStaticContent() {
 *   return this.contentRepository.findStatic();
 * }
 * ```
 */
export function CacheTTL(ttl: number): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) => {
    SetMetadata(CACHE_TTL_METADATA, ttl)(target, propertyKey, descriptor);
    return descriptor;
  };
}

/**
 * Decorator to set cache prefix for a method
 *
 * @param prefix - Cache key prefix
 *
 * @example
 * ```typescript
 * @CachePrefix('courses')
 * @Cacheable(300)
 * async getCourseById(id: string) {
 *   return this.courseRepository.findOne(id);
 * }
 * ```
 */
export function CachePrefix(prefix: string): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) => {
    SetMetadata(CACHE_PREFIX_METADATA, prefix)(target, propertyKey, descriptor);
    return descriptor;
  };
}

/**
 * Decorator to conditionally cache based on method arguments
 *
 * @param condition - Function that returns true if result should be cached
 *
 * @example
 * ```typescript
 * @CacheCondition((result) => result.status === 'published')
 * @Cacheable(300)
 * async getCourse(id: string) {
 *   return this.courseRepository.findOne(id);
 * }
 * ```
 */
export function CacheCondition(
  condition: (result: any, ...args: any[]) => boolean,
): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) => {
    SetMetadata(CACHE_CONDITION_METADATA, condition)(target, propertyKey, descriptor);
    return descriptor;
  };
}
