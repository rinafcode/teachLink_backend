import { TIME } from './time.constants';

/**
 * Throttle presets for rate-limiting across controllers.
 * Each preset defines a limit (max requests) and ttl (time window in ms).
 */
export const THROTTLE = {
  /** 3 requests per hour — strictest, for sensitive operations like registration */
  STRICT: { limit: 3, ttl: TIME.ONE_HOUR_MS },

  /** 5 requests per 15 minutes — login attempts */
  AUTH_LOGIN: { limit: 5, ttl: TIME.FIFTEEN_MINUTES_MS },

  /** 5 requests per hour — password reset, forgot password */
  AUTH_DEFAULT: { limit: 5, ttl: TIME.ONE_HOUR_MS },

  /** 10 requests per hour — moderate protection for payments, media uploads */
  MODERATE: { limit: 10, ttl: TIME.ONE_HOUR_MS },

  /** 20 requests per minute — token refresh */
  REFRESH: { limit: 20, ttl: TIME.ONE_MINUTE_MS },

  /** 30 requests per minute — search endpoints */
  SEARCH: { limit: 30, ttl: TIME.ONE_MINUTE_MS },

  /** 60 requests per minute — admin queue operations */
  QUEUE_ADMIN: { limit: 60, ttl: TIME.ONE_MINUTE_MS },
} as const;
