import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private cacheManager: Cache) {}

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

    const cached = await this.cacheManager.get(key);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return new Observable(observer => {
        observer.next(cached);
        observer.complete();
      });
    }

    return next.handle().pipe(
      tap(async data => {
        await this.cacheManager.set(key, data, parseInt(process.env.REDIS_TTL || '60', 10));
        res.setHeader('X-Cache', 'MISS');
      })
    );
  }
}
