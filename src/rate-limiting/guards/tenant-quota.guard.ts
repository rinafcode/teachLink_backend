import { Injectable, CanActivate, ExecutionContext, HttpException } from '@nestjs/common';

@Injectable()
export class TenantQuotaGuard implements CanActivate {
  private readonly tiers: Record<string, number> = {
    FREE: 100,
    PRO: 1000,
    ENTERPRISE: -1,
  };
  private counters = new Map<string, { count: number; resetAt: number }>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) return true;

    const tier = (req as any).tenantTier || 'FREE';
    const limit = this.tiers[tier] || this.tiers.FREE;
    if (limit === -1) return true;

    const now = Date.now();
    const key = 	enant:;
    const entry = this.counters.get(key);

    if (!entry || now > entry.resetAt) {
      this.counters.set(key, { count: 1, resetAt: now + 60000 });
      return true;
    }

    entry.count++;
    if (entry.count > limit) {
      throw new HttpException('Tenant rate limit exceeded', 429);
    }
    return true;
  }
}