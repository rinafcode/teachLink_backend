export enum UserTier {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FREE = 'FREE',
  PRO = 'PRO',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE',
}

export const QUOTA_LIMITS: Record<
  UserTier,
  { requestsPerMinute: number; requestsPerHour: number; requestsPerDay: number }
> = {
  [UserTier.UNAUTHENTICATED]: { requestsPerMinute: 5, requestsPerHour: 30, requestsPerDay: 100 },
  [UserTier.FREE]: { requestsPerMinute: 10, requestsPerHour: 100, requestsPerDay: 500 },
  [UserTier.PRO]: { requestsPerMinute: 60, requestsPerHour: 1_000, requestsPerDay: 10_000 },
  [UserTier.PREMIUM]: { requestsPerMinute: 200, requestsPerHour: 5_000, requestsPerDay: 50_000 },
  [UserTier.ENTERPRISE]: {
    requestsPerMinute: 1_000,
    requestsPerHour: 50_000,
    requestsPerDay: 500_000,
  },
};

export const QUOTA_RESET_PERIODS = {
  MINUTELY: 'MINUTELY',
  HOURLY: 'HOURLY',
  DAILY: 'DAILY',
} as const;

export type QuotaResetPeriod = keyof typeof QUOTA_RESET_PERIODS;

/** DI token for the quota storage strategy */
export const QUOTA_STORAGE = Symbol('QUOTA_STORAGE');

/**
 * Header that internal services must send alongside INTERNAL_SERVICE_KEY.
 * Requests carrying a valid key bypass all quota checks.
 */
export const INTERNAL_SERVICE_HEADER = 'x-internal-service-key';

/**
 * Comma-separated list of trusted IP addresses that bypass quota checks.
 * Read from RATE_LIMIT_TRUSTED_IPS at startup.
 */
export function getTrustedIps(): Set<string> {
  const raw = process.env.RATE_LIMIT_TRUSTED_IPS ?? '';
  return new Set(
    raw
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean),
  );
}

/** Roles that are unconditionally exempt from quota enforcement. */
export const ADMIN_ROLES = new Set(['admin', 'ADMIN']);
