import { UserRole } from '../../users/entities/user.entity';
import { maskEmail, maskName, maskFull } from './field-masking.util';

/**
 * Defines which fields are masked per role.
 * Fields not listed are always visible.
 * Fields listed are masked for roles that don't have full access.
 */
export interface MaskingPolicy {
  /** Roles that see the raw value. All others get the masked value. */
  visibleTo: UserRole[];
  /** Masking function to apply for unauthorized roles. */
  mask: (value: unknown) => string;
}

/** PII masking policies keyed by field name */
export const USER_MASKING_POLICIES: Record<string, MaskingPolicy> = {
  email: {
    visibleTo: [UserRole.ADMIN],
    mask: (v) => maskEmail(String(v ?? '')),
  },
  firstName: {
    visibleTo: [UserRole.ADMIN, UserRole.TEACHER],
    mask: (v) => maskName(String(v ?? '')),
  },
  lastName: {
    visibleTo: [UserRole.ADMIN, UserRole.TEACHER],
    mask: (v) => maskName(String(v ?? '')),
  },
  password: {
    visibleTo: [],
    mask: maskFull,
  },
  passwordResetToken: {
    visibleTo: [],
    mask: maskFull,
  },
  emailVerificationToken: {
    visibleTo: [],
    mask: maskFull,
  },
  refreshToken: {
    visibleTo: [],
    mask: maskFull,
  },
  passwordHistory: {
    visibleTo: [],
    mask: maskFull,
  },
};

/**
 * Applies role-based masking to a user object.
 * Fields with no policy are returned as-is.
 */
export function applyRoleBasedMasking<T extends Record<string, unknown>>(
  data: T,
  viewerRole: UserRole,
  policies: Record<string, MaskingPolicy> = USER_MASKING_POLICIES,
): T {
  const result = { ...data };

  for (const [field, policy] of Object.entries(policies)) {
    if (!(field in result)) continue;

    if (!policy.visibleTo.includes(viewerRole)) {
      (result as Record<string, unknown>)[field] = policy.mask(result[field]);
    }
  }

  return result;
}
