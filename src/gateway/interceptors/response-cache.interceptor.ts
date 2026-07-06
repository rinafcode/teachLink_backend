import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Request } from 'express';
import { Observable, of, tap } from 'rxjs';
import { GatewayRoutingService } from '../services/gateway-routing.service';

/**
 * Caches GET responses per service+path using the TTL configured on the route.
 * Non-GET requests and routes with cacheTtlSeconds === 0 are skipped.
 */
@Injectable()
export class ResponseCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseCacheInterceptor.name);

  constructor(
    @Optional() @Inject(CACHE_MANAGER) private readonly cache: Cache | null,
    private readonly routing: GatewayRoutingService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (!this.cache) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    if (req.method !== 'GET') return next.handle();

    const rawService = req.params?.service;
    const service = Array.isArray(rawService) ? rawService[0] : rawService;
    if (!service) return next.handle();

    let route;
    try {
      route = this.routing.getRoute(service);
    } catch {
      return next.handle();
    }

    const ttl = route.cacheTtlSeconds;
    if (!ttl) return next.handle();

    const cacheKey = `gw:${service}:${req.path}`;

    const cached = await this.cache.get(cacheKey);
    if (cached !== undefined && cached !== null) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return of(cached);
    }

    return next.handle().pipe(
      tap(async (response) => {
        await this.cache!.set(cacheKey, response, ttl * 1000);
        this.logger.debug(`Cached: ${cacheKey} (${ttl}s)`);
      }),
    );
  }
}
