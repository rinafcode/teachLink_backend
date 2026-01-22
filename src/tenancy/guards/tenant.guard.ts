import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TENANT_KEY } from '../decorators/requires-tenant.decorator';
import { IsolationService } from '../isolation/isolation.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private isolationService: IsolationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresTenant = this.reflector.getAllAndOverride<boolean>(TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiresTenant) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    
    // Try to get tenant from various sources
    const tenantId = request.headers['x-tenant-id'] || 
                     request.query.tenantId || 
                     request.user?.tenantId;

    const tenantSlug = request.headers['x-tenant-slug'] || 
                       request.query.tenantSlug;

    const tenantDomain = request.headers['x-tenant-domain'] || 
                         request.hostname;

    try {
      if (tenantId) {
        await this.isolationService.setTenant(tenantId);
      } else if (tenantSlug) {
        await this.isolationService.setTenantBySlug(tenantSlug);
      } else if (tenantDomain) {
        await this.isolationService.setTenantByDomain(tenantDomain);
      } else {
        throw new UnauthorizedException('Tenant context is required but not provided');
      }

      // Store tenant in request for later use
      request.tenant = this.isolationService.getTenant();

      return true;
    } catch (error) {
      throw new UnauthorizedException(`Failed to set tenant context: ${error.message}`);
    }
  }
}
