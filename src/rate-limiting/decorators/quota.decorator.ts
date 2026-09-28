import { SetMetadata } from '@nestjs/common';
import { UserTier } from '../rate-limiting.constants';

export const QUOTA_KEY = 'quota_options';

export interface QuotaOptions {
  /** Skip quota check for this route (e.g. health checks). */
  skip?: boolean;
  /** Override the tier for this route only. */
  tier?: UserTier;
}

/**
 * Apply to a controller or handler to enforce per-user quota.
 *
 * @example
 * // On a controller — applies to all routes
 * @UseQuota()
 * export class CoursesController {}
 *
 * // On a single route with options
 * @UseQuota({ skip: true })
 * @Get('health')
 * health() {}
 */
export const UseQuota = (options: QuotaOptions = {}): MethodDecorator & ClassDecorator =>
  SetMetadata(QUOTA_KEY, options);

/** Explicitly skip quota enforcement on a handler. */
export const SkipQuota = () => UseQuota({ skip: true });
