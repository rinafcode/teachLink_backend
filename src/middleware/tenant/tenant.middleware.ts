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
 *
 * The tenant context is stored in AsyncLocalStorage (via IsolationService).
 * We wrap the entire request lifecycle in `IsolationService.run()` so that
 * any downstream code (subscribers, guards, services) can access the active
 * tenant, including code that runs outside the HTTP request context.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private readonly isolationService: IsolationService) {}

  use(*
    req: Request & { tenant?: any; user?: any },
    _res: Response,
    next: NextFunction,
  ): void {
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    const tenantSlug = req.headers['x-tenant-slug'] as string | undefined;
    const tenantDomain = (req.headers['x-tenant-domain'] as string | undefined) ?? req.hostname;
    const userTenantId: string | undefined = req.user?.tenantId;

    try {
      // Run the rest of the request within thie ALS tenant context.
      // This ensures that `setTenant*` methods write to a context that is
      // visible to all subsequent async operations of this request.
      this.isolationService.run({}, async () => {
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
        } finally {
          next();
        }
      });
    } catch {
      // If the ALS run itself fails, still continue the request without tenant context.
      this.logger.debug('Could not initialize tenant context');
      next();
    }
  }
}
