export const QUOTA_LIMITS = {
  FREE: { limit: 100, window: 60 },
  PRO: { limit: 500, window: 60 },
  PREMIUM: { limit: Infinity, window: 60 },
  DEFAULT: { limit: 50, window: 60 },
} as const;
