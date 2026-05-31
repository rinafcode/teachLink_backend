import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Protects execution paths based on roles extracted from the user object.
 * Evaluates custom RBAC roles passed from Auth0 token custom claims or local user properties.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  /**
   * Evaluates if the current user has the required roles.
   * @param context The execution context.
   * @returns Whether the operation is allowed.
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('Access denied: User object is missing from the request context.');
      throw new UnauthorizedException('Authentication required');
    }

    // Extract roles from Auth0 custom claims, standard claims, or local user properties
    const userRoles = this.extractRoles(user);

    const hasRole = requiredRoles.some((role) => userRoles.includes(role.toLowerCase()));

    if (!hasRole) {
      this.logger.warn(
        `Access denied: User does not possess any of the required roles [${requiredRoles.join(', ')}]. Extracted user roles: [${userRoles.join(', ')}]`,
      );
    }

    return hasRole;
  }

  /**
   * Safely extracts roles from the user object.
   * Supports Auth0 custom claims namespace, standard roles array (strings or Role entities), standard role string, and local user role.
   * @param user Decoded user token payload or user entity.
   * @returns Array of extracted user roles.
   */
  private extractRoles(user: any): string[] {
    const roles: string[] = [];

    // 1. Check Auth0 custom claims (e.g. https://api.teachlink.com/roles)
    const audience = process.env.AUTH0_AUDIENCE || 'https://api.teachlink.com';
    const namespacedClaims = [
      `${audience}/roles`,
      `${audience}/role`,
      'https://teachlink.com/roles',
      'https://teachlink.com/role',
    ];

    for (const claim of namespacedClaims) {
      const claimVal = user[claim];
      if (claimVal) {
        if (Array.isArray(claimVal)) {
          roles.push(...claimVal);
        } else if (typeof claimVal === 'string') {
          roles.push(claimVal);
        }
      }
    }

    // 2. Check standard 'roles' property (array of strings or Role entities)
    if (user.roles && Array.isArray(user.roles)) {
      for (const r of user.roles) {
        if (typeof r === 'string') {
          roles.push(r);
        } else if (r && typeof r === 'object' && r.name) {
          roles.push(r.name);
        }
      }
    } else if (user.roles && typeof user.roles === 'string') {
      roles.push(user.roles);
    }

    // 3. Check standard 'role' property (used in legacy local JWT/DB implementation)
    if (user.role) {
      if (Array.isArray(user.role)) {
        roles.push(...user.role);
      } else if (typeof user.role === 'string') {
        roles.push(user.role);
      } else if (typeof user.role === 'object' && user.role.name) {
        roles.push(user.role.name);
      }
    }

    // 4. Check permissions array in Auth0 (fallback)
    if (user.permissions && Array.isArray(user.permissions)) {
      roles.push(...user.permissions);
    }

    // Clean up, normalize to lowercase strings, and filter out empty values
    return roles
      .map((r) => String(r).trim().toLowerCase())
      .filter((r) => r.length > 0);
  }
}
