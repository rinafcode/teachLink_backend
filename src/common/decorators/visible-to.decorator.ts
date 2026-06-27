import 'reflect-metadata';
import { UserRole } from '../../users/entities/user.entity';

/**
 * Metadata key used to store {@link VisibleTo} role lists on entity properties.
 * @internal
 */
export const VISIBLE_TO_METADATA_KEY = 'visibleTo:roles';

/**
 * Marks an entity field as visible only to the specified roles.
 *
 * When a response is serialised by {@link RoleVisibilityInterceptor}, any
 * field decorated with `@VisibleTo` that is **not** in the viewer's role list
 * is deleted from the outgoing object before it reaches the client.
 *
 * Placing `@VisibleTo` on a new field is sufficient to enforce visibility —
 * no additional per-route configuration is needed.
 *
 * @example
 * ```ts
 * \@VisibleTo(UserRole.ADMIN)
 * refreshToken?: string;
 *
 * \@VisibleTo(UserRole.ADMIN, UserRole.MODERATOR)
 * sensitiveScore?: number;
 * ```
 */
export function VisibleTo(...roles: UserRole[]): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    // Accumulate existing metadata so multiple decorators on the same class
    // don't overwrite each other.
    const existing: Map<string | symbol, UserRole[]> =
      Reflect.getOwnMetadata(VISIBLE_TO_METADATA_KEY, target.constructor) ?? new Map();
    existing.set(propertyKey, roles);
    Reflect.defineMetadata(VISIBLE_TO_METADATA_KEY, existing, target.constructor);
  };
}

/**
 * Returns the `@VisibleTo` role map for a given constructor, or `null` when
 * the class has no `@VisibleTo` annotations.
 *
 * @internal Used by {@link RoleVisibilityInterceptor}.
 */
export function getVisibilityMap(
  ctor: new (...args: unknown[]) => unknown,
): Map<string | symbol, UserRole[]> | null {
  return Reflect.getOwnMetadata(VISIBLE_TO_METADATA_KEY, ctor) ?? null;
}
