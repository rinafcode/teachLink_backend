import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { UserRole } from '../../users/entities/user.entity';
import { getVisibilityMap } from '../decorators/visible-to.decorator';

interface JwtUser {
  userId?: string;
  role?: UserRole;
  roles?: string[];
}

/**
 * Global interceptor that enforces `@VisibleTo` field-level visibility.
 *
 * For every outgoing response it:
 *  1. Determines the viewer's role from `request.user`.
 *  2. Inspects each plain-object value in the response recursively.
 *  3. Looks up the `@VisibleTo` metadata on the value's constructor.
 *  4. Deletes any field that the viewer's role is not permitted to see.
 *
 * Fields without a `@VisibleTo` annotation are always returned as-is.
 * Unauthenticated requests are not affected (auth guards handle access).
 *
 * Supports single objects, arrays, and paginated responses shaped as
 * `{ data: [...], ... }` or `{ items: [...], ... }`.
 */
@Injectable()
export class RoleVisibilityInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtUser }>();
    const viewer = req.user;

    // Skip unauthenticated requests — auth guards control access.
    if (!viewer) {
      return next.handle();
    }

    const viewerRole = this.resolveRole(viewer);

    return next.handle().pipe(map((data) => this.strip(data, viewerRole)));
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private resolveRole(user: JwtUser): UserRole {
    if (user.role) return user.role;
    // JWT payloads may carry roles as a string array
    if (user.roles && user.roles.length > 0) {
      return user.roles[0] as UserRole;
    }
    return UserRole.STUDENT;
  }

  /**
   * Recursively strips restricted fields from `data`.
   * Returns primitive values and nulls unchanged.
   */
  private strip(data: unknown, role: UserRole): unknown {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.strip(item, role));
    }

    const record = data as Record<string, unknown>;

    // Paginated response shapes — recurse into the items array.
    if (Array.isArray(record['data'])) {
      return { ...record, data: (record['data'] as unknown[]).map((i) => this.strip(i, role)) };
    }
    if (Array.isArray(record['items'])) {
      return { ...record, items: (record['items'] as unknown[]).map((i) => this.strip(i, role)) };
    }

    return this.stripFields(record, role);
  }

  /**
   * Removes fields whose `@VisibleTo` annotation excludes the viewer's role.
   */
  private stripFields(obj: Record<string, unknown>, role: UserRole): Record<string, unknown> {
    // Only inspect objects that came from a decorated class.
    const ctor = Object.getPrototypeOf(obj)?.constructor as
      | (new (...args: unknown[]) => unknown)
      | undefined;

    const visibilityMap = ctor ? getVisibilityMap(ctor) : null;

    if (!visibilityMap) {
      // No @VisibleTo annotations on this class — return a shallow copy as-is.
      return { ...obj };
    }

    const result: Record<string, unknown> = { ...obj };

    for (const [field, allowedRoles] of visibilityMap.entries()) {
      const key = String(field);
      if (!(key in result)) continue;

      if (!allowedRoles.includes(role)) {
        delete result[key];
      }
    }

    return result;
  }
}
