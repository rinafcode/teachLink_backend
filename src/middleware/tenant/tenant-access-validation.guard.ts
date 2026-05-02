import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IsolationService } from '../../tenancy/isolation/isolation.service';
import { TENANT_KEY } from '../../tenancy/decorators/requires-tenant.decorator';

/**
 * TenantAccessValidationGuard validates that:
 *  1. A tenant context is present when the route requires it (@RequiresTenant).
 *  2. The authenticated user belongs to the active tenant.
 *  3. The tenant is active (not suspended/inactive).
 *
 * Apply globally or per-controller/route alongside @RequiresTenant().
 */
@Injectable()
export class TenantAccessValidationGuard implements CanActivate {
  private readonly logger = new Logger(TenantAccessValidationGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly isolationService: IsolationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresTenant = this.reflector.getAllAndOverride<boolean>(TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiresTenant) return true;

    const request = context.switchToHttp().getRequest<{ user?: any; tenant?: any }>();

    // 1. Tenant context must be set (by TenantMiddleware)
    if (!this.isolationService.hasTenantContext()) {
      throw new UnauthorizedException('Tenant context is required');
    }

    // 2. Tenant must be active
    if (!this.isolationService.isActiveTenant()) {
      const tenant = this.isolationService.getTenant();
      this.logger.warn(
        `Access denied: tenant ${tenant?.id} is not active (status=${tenant?.status})`,
      );
      throw new ForbiddenException('Tenant is not active');
    }

    // 3. Authenticated user must belong to the active tenant
    const user = request.user;
    if (user) {
      const currentTenantId = this.isolationService.getTenantId();
      if (user.tenantId && user.tenantId !== currentTenantId) {
        this.logger.warn(
          `Access denied: user tenantId=${user.tenantId} does not match active tenant=${currentTenantId}`,
        );
        throw new ForbiddenException('User does not belong to this tenant');
      }
    }

    return true;
  }
}
