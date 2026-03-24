/**
 * Feature flags configuration for conditional module loading
 * Used to control which modules are loaded at application startup
 */

export interface FeatureFlagsConfig {
  // Core feature flags
  ENABLE_AUTH: boolean;
  ENABLE_SESSION_MANAGEMENT: boolean;

  // Optional feature modules
  ENABLE_PAYMENTS: boolean;
  ENABLE_AB_TESTING: boolean;
  ENABLE_DATA_WAREHOUSE: boolean;
  ENABLE_COLLABORATION: boolean;
  ENABLE_MEDIA_PROCESSING: boolean;
  ENABLE_BACKUP: boolean;
  ENABLE_GRAPHQL: boolean;
  ENABLE_SYNC: boolean;
  ENABLE_MIGRATIONS: boolean;
  ENABLE_RATE_LIMITING: boolean;
  ENABLE_OBSERVABILITY: boolean;
  ENABLE_CACHING: boolean;
  ENABLE_FEATURE_FLAGS: boolean;
  ENABLE_SEARCH: boolean;
  ENABLE_NOTIFICATIONS: boolean;
  ENABLE_EMAIL_MARKETING: boolean;
  ENABLE_GAMIFICATION: boolean;
  ENABLE_ASSESSMENT: boolean;
  ENABLE_LEARNING_PATHS: boolean;
  ENABLE_MODERATION: boolean;
  ENABLE_ORCHESTRATION: boolean;
  ENABLE_SECURITY: boolean;
  ENABLE_TENANCY: boolean;
  ENABLE_CDN: boolean;
}

/**
 * Default feature flags - all features enabled by default
 */
export const defaultFeatureFlags: FeatureFlagsConfig = {
  ENABLE_AUTH: true,
  ENABLE_SESSION_MANAGEMENT: true,
  ENABLE_PAYMENTS: true,
  ENABLE_AB_TESTING: false,
  ENABLE_DATA_WAREHOUSE: false,
  ENABLE_COLLABORATION: true,
  ENABLE_MEDIA_PROCESSING: true,
  ENABLE_BACKUP: true,
  ENABLE_GRAPHQL: false,
  ENABLE_SYNC: true,
  ENABLE_MIGRATIONS: true,
  ENABLE_RATE_LIMITING: true,
  ENABLE_OBSERVABILITY: true,
  ENABLE_CACHING: true,
  ENABLE_FEATURE_FLAGS: true,
  ENABLE_SEARCH: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_EMAIL_MARKETING: true,
  ENABLE_GAMIFICATION: true,
  ENABLE_ASSESSMENT: true,
  ENABLE_LEARNING_PATHS: true,
  ENABLE_MODERATION: true,
  ENABLE_ORCHESTRATION: true,
  ENABLE_SECURITY: true,
  ENABLE_TENANCY: true,
  ENABLE_CDN: true,
};

/**
 * Load feature flags from environment variables
 */
export function loadFeatureFlags(): FeatureFlagsConfig {
  return {
    ENABLE_AUTH: getBooleanEnv('ENABLE_AUTH', defaultFeatureFlags.ENABLE_AUTH),
    ENABLE_SESSION_MANAGEMENT: getBooleanEnv(
      'ENABLE_SESSION_MANAGEMENT',
      defaultFeatureFlags.ENABLE_SESSION_MANAGEMENT,
    ),
    ENABLE_PAYMENTS: getBooleanEnv('ENABLE_PAYMENTS', defaultFeatureFlags.ENABLE_PAYMENTS),
    ENABLE_AB_TESTING: getBooleanEnv('ENABLE_AB_TESTING', defaultFeatureFlags.ENABLE_AB_TESTING),
    ENABLE_DATA_WAREHOUSE: getBooleanEnv(
      'ENABLE_DATA_WAREHOUSE',
      defaultFeatureFlags.ENABLE_DATA_WAREHOUSE,
    ),
    ENABLE_COLLABORATION: getBooleanEnv(
      'ENABLE_COLLABORATION',
      defaultFeatureFlags.ENABLE_COLLABORATION,
    ),
    ENABLE_MEDIA_PROCESSING: getBooleanEnv(
      'ENABLE_MEDIA_PROCESSING',
      defaultFeatureFlags.ENABLE_MEDIA_PROCESSING,
    ),
    ENABLE_BACKUP: getBooleanEnv('ENABLE_BACKUP', defaultFeatureFlags.ENABLE_BACKUP),
    ENABLE_GRAPHQL: getBooleanEnv('ENABLE_GRAPHQL', defaultFeatureFlags.ENABLE_GRAPHQL),
    ENABLE_SYNC: getBooleanEnv('ENABLE_SYNC', defaultFeatureFlags.ENABLE_SYNC),
    ENABLE_MIGRATIONS: getBooleanEnv('ENABLE_MIGRATIONS', defaultFeatureFlags.ENABLE_MIGRATIONS),
    ENABLE_RATE_LIMITING: getBooleanEnv(
      'ENABLE_RATE_LIMITING',
      defaultFeatureFlags.ENABLE_RATE_LIMITING,
    ),
    ENABLE_OBSERVABILITY: getBooleanEnv(
      'ENABLE_OBSERVABILITY',
      defaultFeatureFlags.ENABLE_OBSERVABILITY,
    ),
    ENABLE_CACHING: getBooleanEnv('ENABLE_CACHING', defaultFeatureFlags.ENABLE_CACHING),
    ENABLE_FEATURE_FLAGS: getBooleanEnv(
      'ENABLE_FEATURE_FLAGS',
      defaultFeatureFlags.ENABLE_FEATURE_FLAGS,
    ),
    ENABLE_SEARCH: getBooleanEnv('ENABLE_SEARCH', defaultFeatureFlags.ENABLE_SEARCH),
    ENABLE_NOTIFICATIONS: getBooleanEnv(
      'ENABLE_NOTIFICATIONS',
      defaultFeatureFlags.ENABLE_NOTIFICATIONS,
    ),
    ENABLE_EMAIL_MARKETING: getBooleanEnv(
      'ENABLE_EMAIL_MARKETING',
      defaultFeatureFlags.ENABLE_EMAIL_MARKETING,
    ),
    ENABLE_GAMIFICATION: getBooleanEnv(
      'ENABLE_GAMIFICATION',
      defaultFeatureFlags.ENABLE_GAMIFICATION,
    ),
    ENABLE_ASSESSMENT: getBooleanEnv('ENABLE_ASSESSMENT', defaultFeatureFlags.ENABLE_ASSESSMENT),
    ENABLE_LEARNING_PATHS: getBooleanEnv(
      'ENABLE_LEARNING_PATHS',
      defaultFeatureFlags.ENABLE_LEARNING_PATHS,
    ),
    ENABLE_MODERATION: getBooleanEnv('ENABLE_MODERATION', defaultFeatureFlags.ENABLE_MODERATION),
    ENABLE_ORCHESTRATION: getBooleanEnv(
      'ENABLE_ORCHESTRATION',
      defaultFeatureFlags.ENABLE_ORCHESTRATION,
    ),
    ENABLE_SECURITY: getBooleanEnv('ENABLE_SECURITY', defaultFeatureFlags.ENABLE_SECURITY),
    ENABLE_TENANCY: getBooleanEnv('ENABLE_TENANCY', defaultFeatureFlags.ENABLE_TENANCY),
    ENABLE_CDN: getBooleanEnv('ENABLE_CDN', defaultFeatureFlags.ENABLE_CDN),
  };
}

/**
 * Helper function to parse boolean environment variables
 */
function getBooleanEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get list of enabled modules based on feature flags
 */
export function getEnabledModules(flags: FeatureFlagsConfig): string[] {
  const modules: string[] = [];

  if (flags.ENABLE_AUTH) modules.push('AuthModule');
  if (flags.ENABLE_PAYMENTS) modules.push('PaymentsModule');
  if (flags.ENABLE_AB_TESTING) modules.push('ABTestingModule');
  if (flags.ENABLE_DATA_WAREHOUSE) modules.push('DataWarehouseModule');
  if (flags.ENABLE_COLLABORATION) modules.push('CollaborationModule');
  if (flags.ENABLE_MEDIA_PROCESSING) modules.push('MediaModule');
  if (flags.ENABLE_BACKUP) modules.push('BackupModule');
  if (flags.ENABLE_GRAPHQL) modules.push('GraphQLModule');
  if (flags.ENABLE_SYNC) modules.push('SyncModule');
  if (flags.ENABLE_MIGRATIONS) modules.push('MigrationModule');
  if (flags.ENABLE_RATE_LIMITING) modules.push('RateLimitingModule');
  if (flags.ENABLE_OBSERVABILITY) modules.push('ObservabilityModule');
  if (flags.ENABLE_CACHING) modules.push('CachingModule');
  if (flags.ENABLE_FEATURE_FLAGS) modules.push('FeatureFlagsModule');
  if (flags.ENABLE_SEARCH) modules.push('SearchModule');
  if (flags.ENABLE_NOTIFICATIONS) modules.push('NotificationsModule');
  if (flags.ENABLE_EMAIL_MARKETING) modules.push('EmailMarketingModule');
  if (flags.ENABLE_GAMIFICATION) modules.push('GamificationModule');
  if (flags.ENABLE_ASSESSMENT) modules.push('AssessmentModule');
  if (flags.ENABLE_LEARNING_PATHS) modules.push('LearningPathsModule');
  if (flags.ENABLE_MODERATION) modules.push('ModerationModule');
  if (flags.ENABLE_ORCHESTRATION) modules.push('OrchestrationModule');
  if (flags.ENABLE_SECURITY) modules.push('SecurityModule');
  if (flags.ENABLE_TENANCY) modules.push('TenancyModule');
  if (flags.ENABLE_CDN) modules.push('CDNModule');

  return modules;
}

/**
 * Get list of disabled modules based on feature flags
 */
export function getDisabledModules(flags: FeatureFlagsConfig): string[] {
  const allModules = Object.keys(defaultFeatureFlags)
    .filter((key) => key.startsWith('ENABLE_'))
    .map((key) => `${key.replace('ENABLE_', '')}Module`);

  const enabledModules = getEnabledModules(flags);

  return allModules.filter((module) => !enabledModules.includes(module));
}
