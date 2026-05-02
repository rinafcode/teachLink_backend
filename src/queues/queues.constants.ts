/**
 * Queue-related constants for job prioritization, retry strategies, and monitoring.
 */
export const PRIORITY_SCORES = {
  // User tier scores (0-30 points)
  TIER_PREMIUM: 30,
  TIER_PRO: 20,
  TIER_BASIC: 10,
  TIER_FREE: 0,

  // Urgency scores (0-25 points)
  URGENCY_CRITICAL: 25,
  URGENCY_HIGH: 20,
  URGENCY_MEDIUM: 10,
  URGENCY_LOW: 0,

  // Business impact scores (0-25 points)
  IMPACT_REVENUE: 25,
  IMPACT_CUSTOMER: 20,
  IMPACT_OPERATIONAL: 15,
  IMPACT_INTERNAL: 5,

  // Time sensitivity scores (0-20 points)
  TIME_WITHIN_1H: 20,
  TIME_WITHIN_6H: 15,
  TIME_WITHIN_24H: 10,
  TIME_WITHIN_72H: 5,
} as const;

export const PRIORITY_THRESHOLDS = {
  CRITICAL_MIN: 70,
  HIGH_MIN: 50,
  NORMAL_MIN: 30,
  LOW_MIN: 15,
} as const;

export const PRIORITY_JOB_CONFIG = {
  CRITICAL: {
    attempts: 5,
    timeoutMs: 60_000,
    backoffType: 'exponential' as const,
    backoffDelayMs: 1_000,
    removeOnComplete: false,
    removeOnFail: false,
  },
  HIGH: {
    attempts: 4,
    timeoutMs: 45_000,
    backoffType: 'exponential' as const,
    backoffDelayMs: 2_000,
    removeOnComplete: true,
    removeOnFail: false,
  },
  NORMAL: {
    attempts: 3,
    timeoutMs: 30_000,
    backoffType: 'exponential' as const,
    backoffDelayMs: 3_000,
    removeOnComplete: true,
    removeOnFail: false,
  },
  LOW: {
    attempts: 2,
    timeoutMs: 20_000,
    backoffType: 'fixed' as const,
    backoffDelayMs: 5_000,
    removeOnComplete: true,
    removeOnFail: true,
  },
  BACKGROUND: {
    attempts: 1,
    timeoutMs: 15_000,
    backoffType: 'fixed' as const,
    backoffDelayMs: 10_000,
    removeOnComplete: true,
    removeOnFail: true,
  },
} as const;

export const RETRY_STRATEGIES = {
  EMAIL: {
    maxAttempts: 5,
    backoffType: 'exponential' as const,
    initialDelayMs: 2_000,
    maxDelayMs: 60_000,
    multiplier: 2,
  },
  PAYMENT: {
    maxAttempts: 3,
    backoffType: 'exponential' as const,
    initialDelayMs: 5_000,
    maxDelayMs: 30_000,
    multiplier: 2,
  },
  NOTIFICATION: {
    maxAttempts: 4,
    backoffType: 'exponential' as const,
    initialDelayMs: 1_000,
    maxDelayMs: 20_000,
    multiplier: 2,
  },
  BACKUP: {
    maxAttempts: 3,
    backoffType: 'fixed' as const,
    initialDelayMs: 10_000,
  },
  REPORT: {
    maxAttempts: 2,
    backoffType: 'fixed' as const,
    initialDelayMs: 5_000,
  },
  DEFAULT: {
    maxAttempts: 3,
    backoffType: 'exponential' as const,
    initialDelayMs: 3_000,
    maxDelayMs: 30_000,
    multiplier: 2,
  },
} as const;

export const QUEUE_DEFAULTS = {
  DEFAULT_TIMEOUT_MS: 30_000,
  STUCK_JOB_THRESHOLD_MS: 300_000,
  CLEAN_GRACE_MS: 5_000,
  SCHEDULED_MIN_DELAY_MS: 5_000,
  EXPORT_QUEUE_DELAY_MS: 2_000,
  WEBHOOK_QUEUE_DELAY_MS: 1_000,
  WEBHOOK_MAX_RETRY_DELAY_MS: 3_600_000,
  WEBHOOK_INITIAL_DELAY_MS: 1_000,
  BACKOFF_MULTIPLIER: 2,
  MAX_RETRIES: 3,
  EXPORT_REMOVE_THRESHOLD: 50,
} as const;

export const QUEUE_HEALTH_THRESHOLDS = {
  FAILURE_RATE_CRITICAL: 0.2,
  FAILURE_RATE_WARNING: 0.1,
  BACKLOG_CRITICAL: 5_000,
  BACKLOG_WARNING: 1_000,
  ACTIVE_JOBS_CRITICAL: 500,
  ACTIVE_JOBS_WARNING: 100,
  DELAYED_JOBS_WARNING: 500,
  STUCK_THRESHOLD_MS: 300_000,
  MAX_HISTORY_SIZE: 100,
  METRICS_SNAPSHOT_INTERVAL_MS: 60_000,
  ANALYTICS_WINDOW_MINUTES: 60,
} as const;

export const JOB_AGE_THRESHOLDS = {
  LONG_WAIT_HOURS: 24,
  EXTENDED_WAIT_HOURS: 12,
} as const;
