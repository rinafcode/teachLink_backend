import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Intercepts cache request handling.
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private cacheManager: Cache) {}

  /**
   * Executes intercept.
   * @param context The context.
   * @param next The next.
   * @returns The resulting observable<any>.
   */
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const key = req.originalUrl;

    // Only cache GET requests
    if (req.method !== 'GET') {
      // Invalidate cache for mutations
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        await this.cacheManager.del(key);
      }
      return next.handle();
    }
}
