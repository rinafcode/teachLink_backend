import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestDedupInterceptor implements NestInterceptor {
  private cache = new Map<string, { response: any; timestamp: number }>();
  private readonly ttlMs = 60000;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (req.method !== 'POST') return next.handle();

    const key = this.fingerprint(req);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttlMs) {
      const res = context.switchToHttp().getResponse();
      res.setHeader('X-Duplicate-Request', 'true');
      return of(cached.response);
    }

    return next.handle().pipe(
      tap((response) => {
        this.cache.set(key, { response, timestamp: Date.now() });
      }),
    );
  }

  private fingerprint(req: any): string {
    const method = req.method;
    const path = req.path;
    const body = JSON.stringify(req.body);
    const userId = req.user ? req.user.id : 'anon';
    return method + ':' + path + ':' + body + ':' + userId;
  }
}
