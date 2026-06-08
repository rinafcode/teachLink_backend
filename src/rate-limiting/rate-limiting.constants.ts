export enum UserTier {
  FREE = 'FREE',
  PRO = 'PRO',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE',
}

export const QUOTA_LIMITS: Record<
  UserTier,
  { requestsPerMinute: number; requestsPerHour: number; requestsPerDay: number }
> = {
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
