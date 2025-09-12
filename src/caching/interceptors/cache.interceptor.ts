import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
  Logger,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { type Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { CachingService, CacheOptions } from '../caching.service';
import {
  CACHEABLE_KEY,
  CACHE_KEY_GENERATOR,
  CACHE_CONDITION,
} from '../decorators/cacheable.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly caching: CachingService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const cacheOptions = this.reflector.get<CacheOptions>(
      CACHEABLE_KEY,
      context.getHandler(),
    );

    if (!cacheOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const cacheKey = this.generateCacheKey(context, cacheOptions);

    // Check cache condition
    const condition = this.reflector.get(CACHE_CONDITION, context.getHandler());
    if (condition && !condition(...this.getMethodArgs(context))) {
      return next.handle();
    }

    try {
      // Try to get from cache
      const cachedResult = await this.caching.get(cacheKey, cacheOptions);
      if (cachedResult !== null) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        return of(cachedResult);
      }

      // Execute method and cache result
      return next.handle().pipe(
        tap(async (result) => {
          if (result !== null && result !== undefined) {
            await this.caching.set(cacheKey, result, cacheOptions);
            this.logger.debug(`Cached result for key: ${cacheKey}`);
          }
        }),
      );
    } catch (error) {
      this.logger.error(`Cache interceptor error for key ${cacheKey}`, error);
      return next.handle();
    }
  }

  private generateCacheKey(
    context: ExecutionContext,
    options: CacheOptions,
  ): string {
    const keyGenerator = this.reflector.get(
      CACHE_KEY_GENERATOR,
      context.getHandler(),
    );

    if (keyGenerator) {
      return keyGenerator(...this.getMethodArgs(context));
    }

    const className = context.getClass().name;
    const methodName = context.getHandler().name;
    const args = this.getMethodArgs(context);

    // Generate default key based on class, method, and arguments
    const argsHash = this.hashArgs(args);
    return `${className}:${methodName}:${argsHash}`;
  }

  private getMethodArgs(context: ExecutionContext): any[] {
    const request = context.switchToHttp().getRequest();
    return [request.params, request.query, request.body].filter(Boolean);
  }

  private hashArgs(args: any[]): string {
    try {
      return Buffer.from(JSON.stringify(args))
        .toString('base64')
        .substring(0, 16);
    } catch {
      return 'default';
    }
  }
}
