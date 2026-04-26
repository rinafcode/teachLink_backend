/**
 * Tenancy-related constants for plan limits, billing rates, and defaults.
 */
export const TENANT_PLAN_LIMITS = {
  FREE: { userLimit: 10, storageLimit: 1024 }, // 1GB
  BASIC: { userLimit: 50, storageLimit: 10240 }, // 10GB
  PROFESSIONAL: { userLimit: 200, storageLimit: 51200 }, // 50GB
  ENTERPRISE: { userLimit: -1, storageLimit: -1 }, // Unlimited
} as const;

export const TENANT_DEFAULTS = {
  USER_LIMIT: 10,
  STORAGE_LIMIT_MB: 1024,
  SESSION_TIMEOUT_SECONDS: 3600,
  DEFAULT_PAGE_SIZE: 10,
} as const;

export const TENANT_BILLING_RATES = {
  STORAGE_COST_PER_GB: 0.1,
  API_COST_PER_THOUSAND: 0.01,
  COST_PER_ACTIVE_USER: 5,
  MONTHLY_FEE_BASIC: 29,
  MONTHLY_FEE_PROFESSIONAL: 99,
  MONTHLY_FEE_ENTERPRISE: 299,
} as const;

export const TENANT_HEALTH_SCORE = {
  MAX_SCORE: 100,
  SUSPENSION_PENALTY: 50,
  TRIAL_EXPIRED_PENALTY: 20,
  USAGE_LIMIT_PENALTY: 10,
  OUTSTANDING_BALANCE_PENALTY: 15,
  USAGE_WARNING_PERCENT: 90,
  HEALTHY_THRESHOLD: 70,
  WARNING_THRESHOLD: 40,
} as const;
