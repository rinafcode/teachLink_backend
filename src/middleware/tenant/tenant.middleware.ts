import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IsolationService } from '../../tenancy/isolation/isolation.service';

/**
 * TenantMiddleware resolves the tenant from the incoming request and sets
 * the tenant context on the IsolationService for the duration of the request.
 *
 * Resolution order:
 *  1. x-tenant-id header
 *  2. x-tenant-slug header
 *  3. x-tenant-domain header (falls back to request hostname)
 *  4. Authenticated user's tenantId (req.user?.tenantId)
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private readonly isolationService: IsolationService) {}

  async use(
    req: Request & { tenant?: any; user?: any },
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    const tenantSlug = req.headers['x-tenant-slug'] as string | undefined;
    const tenantDomain = (req.headers['x-tenant-domain'] as string | undefined) ?? req.hostname;
    const userTenantId: string | undefined = req.user?.tenantId;

    try {
      if (tenantId) {
        await this.isolationService.setTenant(tenantId);
      } else if (tenantSlug) {
        await this.isolationService.setTenantBySlug(tenantSlug);
      } else if (userTenantId) {
        await this.isolationService.setTenant(userTenantId);
      } else if (tenantDomain) {
        await this.isolationService.setTenantByDomain(tenantDomain);
      }

      if (this.isolationService.hasTenantContext()) {
        req.tenant = this.isolationService.getTenant();
        this.logger.debug(`Tenant context set: ${this.isolationService.getTenantId()}`);
      }
    } catch {
      // Non-fatal: tenant context may not be required for all routes.
      // TenantGuard / TenantAccessValidationGuard will enforce it where needed.
      this.logger.debug('Could not resolve tenant context from request');
    }

    next();
  }
}
