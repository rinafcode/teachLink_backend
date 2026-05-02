import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TENANT_KEY } from '../decorators/requires-tenant.decorator';
import { IsolationService } from '../isolation/isolation.service';

/**
 * Protects tenant execution paths.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private isolationService: IsolationService,
  ) {}

  /**
   * Executes can Activate.
   * @param context The context.
   * @returns Whether the operation succeeded.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresTenant = this.reflector.getAllAndOverride<boolean>(TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiresTenant) {
      return true;
    }
}
