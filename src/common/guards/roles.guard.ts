import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Role, ROLES_KEY } from '../decorators/roles.decorator';

interface JwtUser {
  id: string | number;
  email?: string;
  role: Role;
}

/**
 * #158 – RolesGuard
 *
 * Must be used together with an AuthGuard that populates `request.user`
 * from a validated JWT. The guard:
 *
 *  1. Skips routes that have no @Roles() decorator (public by default).
 *  2. Rejects unauthenticated requests with 401.
 *  3. Rejects authenticated requests whose role is not in the allowed list with 403.
 *
 * Registration (choose one):
 *   - Globally:  app.useGlobalGuards(new RolesGuard(reflector))  in main.ts
 *   - Per-module: providers: [RolesGuard]  and add @UseGuards(JwtAuthGuard, RolesGuard)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Collect roles from the handler first, then fall back to the controller level
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator → route is unrestricted at the role level
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: JwtUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException(
        'Authentication is required to access this resource.',
      );
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      this.logger.warn(
        `Access denied: user ${user.id} (role="${user.role}") attempted to access ` +
          `[${context.getClass().name}::${context.getHandler().name}] ` +
          `which requires role(s): [${requiredRoles.join(', ')}]`,
      );
      throw new ForbiddenException(
        `You do not have permission to perform this action. ` +
          `Required role(s): ${requiredRoles.join(' or ')}.`,
      );
    }

    return true;
  }
}