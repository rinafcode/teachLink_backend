import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export const MASK_FIELDS_KEY = 'maskFields';

export interface FieldMaskConfig {
  /** Field names to mask */
  fields: string[];
  /** Roles that see the raw value */
  visibleTo: UserRole[];
}

/**
 * Decorator to declare which fields should be masked and for which roles.
 * Apply to controller methods.
 *
 * @example
 * @MaskFields({ fields: ['email', 'firstName'], visibleTo: [UserRole.ADMIN] })
 */
export const MaskFields = (config: FieldMaskConfig) => SetMetadata(MASK_FIELDS_KEY, config);
