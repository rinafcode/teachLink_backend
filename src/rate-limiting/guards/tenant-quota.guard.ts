import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request, Response } from 'express';
import { RateLimitExceededException } from '../../common/exceptions/app.exceptions';

@Injectable()
export class TenantQuotaGuard implements CanActivate {
  private readonly tiers: Record<string, number> = {
    FREE: 100,
    PRO: 1000,
    ENTERPRISE: -1,
  };
  private counters = new Map<string, { count: number; resetAt: number }>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) return true;

    const tier = (req as any).tenantTier || 'FREE';
    const limit = this.tiers[tier] || this.tiers.FREE;
    if (limit === -1) return true;

    const now = Date.now();
    const key = tenantId;
    const entry = this.counters.get(key);

    if (!entry || now > entry.resetAt) {
      this.counters.set(key, { count: 1, resetAt: now + 60000 });
      return true;
    }

    entry.count++;
    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      const resetTime = Math.floor(now / 1000) + retryAfter;
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', resetTime);
      throw new RateLimitExceededException(retryAfter);
    }
    return true;
  }
}
