import { SetMetadata } from '@nestjs/common';

/**
 * #158 – System roles
 *
 * Extend this enum as the platform grows (e.g. MODERATOR, DAO_MEMBER, etc.).
 */
export enum Role {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
}

export const ROLES_KEY = 'roles';

/**
 * Attach required roles to a route or controller.
 *
 * @example
 * \@Roles(Role.ADMIN)
 * \@Get('admin/dashboard')
 * getDashboard() {}
 *
 * \@Roles(Role.MODERATOR, Role.ADMIN)
 * \@Delete('posts/:id')
 * deletePost() {}
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);