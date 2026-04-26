import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { TenancyService } from './tenancy.service';

export const SKIP_TENANT_CHECK = 'skipTenantCheck';

@Injectable()
export class TenancyGuard implements CanActivate {
  private readonly logger = new Logger(TenancyGuard.name);

  constructor(
    private readonly tenancyService: TenancyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) return true;

    let req: any;

    // Support both HTTP and GraphQL contexts
    if (context.getType() === 'http') {
      req = context.switchToHttp().getRequest();
    } else {
      const gqlCtx = GqlExecutionContext.create(context);
      req = gqlCtx.getContext().req;
    }

    const tenantId = this.tenancyService.getTenantFromRequest(req);
    await this.tenancyService.validateTenantExists(tenantId);

    // Attach tenantId to request for downstream use
    req.tenantId = tenantId;

    this.logger.log(`Tenant "${tenantId}" verified successfully`);
    return true;
  }
}