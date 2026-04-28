/**
 * Feature Flags Configuration
 *
 * This file is the single source of truth for all feature flags.
 * Flags must be documented below before use.
 * Remove flags here AND all consuming references when a feature is
 * fully shipped or permanently disabled.
 *
 * Active flags:
 * - ENABLE_AUTH: Gates the AuthModule for user authentication and authorization
 * - ENABLE_PAYMENTS: Gates the PaymentsModule for Stripe-based payment processing
 * - ENABLE_AB_TESTING: Gates the ABTestingModule for experiment-based feature rollouts
 * - ENABLE_DATA_WAREHOUSE: Gates the DataWarehouseModule for analytics data pipelines
 * - ENABLE_COLLABORATION: Gates the CollaborationModule for real-time collaboration features
 * - ENABLE_MEDIA_PROCESSING: Gates the MediaModule for file upload and media processing
 * - ENABLE_BACKUP: Gates the BackupModule for automated data backup routines
 * - ENABLE_GRAPHQL: Gates the GraphQLModule for the GraphQL API layer
 * - ENABLE_SYNC: Gates the SyncModule for cross-device data synchronization
 * - ENABLE_MIGRATIONS: Gates the MigrationModule for database schema migrations
 * - ENABLE_RATE_LIMITING: Gates the RateLimitingModule for request throttling
 * - ENABLE_OBSERVABILITY: Gates the ObservabilityModule for tracing and metrics
 * - ENABLE_CACHING: Gates the CachingModule for application-level caching
 * - ENABLE_FEATURE_FLAGS: Gates the FeatureFlagsModule for runtime feature flag management
 * - ENABLE_SEARCH: Gates the SearchModule for Elasticsearch-based search
 * - ENABLE_NOTIFICATIONS: Gates the NotificationsModule for push/email/in-app notifications
 * - ENABLE_EMAIL_MARKETING: Gates the EmailMarketingModule for SendGrid-based campaigns
 * - ENABLE_GAMIFICATION: Gates the GamificationModule for points, badges, and leaderboards
 * - ENABLE_ASSESSMENT: Gates the AssessmentModule for quizzes and assessments
 * - ENABLE_LEARNING_PATHS: Gates the LearningPathsModule for structured learning sequences
 * - ENABLE_MODERATION: Gates the ModerationModule for content moderation
 * - ENABLE_ORCHESTRATION: Gates the OrchestrationModule for workflow orchestration
 * - ENABLE_SECURITY: Gates the SecurityModule for advanced security features
 * - ENABLE_TENANCY: Gates the TenancyModule for multi-tenant isolation
 * - ENABLE_CDN: Gates the CDNModule for CDN/CloudFront asset delivery
 * - ENABLE_LOCALIZATION: Gates the LocalizationModule for i18n/l10n support
 * - ENABLE_ONBOARDING: Gates the OnboardingModule for user onboarding flow
 *
 * To add a new flag:
 * 1. Add the constant here with a JSDoc comment
 * 2. Import and use it in the relevant service/guard/middleware
 * 3. Update the active flags list above
 */

export interface IFeatureFlagsConfig {
  /** Gates the AuthModule — controls user authentication and authorization.
   *  `true`: AuthModule is loaded at startup.
   *  `false`: AuthModule is skipped; all auth-gated endpoints become unavailable. */
  ENABLE_AUTH: boolean;

  /** Gates the PaymentsModule — controls Stripe-based payment processing.
   *  `true`: PaymentsModule is loaded, payment endpoints available.
   *  `false`: PaymentsModule is skipped, payment endpoints unavailable. */
  ENABLE_PAYMENTS: boolean;

  /** Gates the ABTestingModule — controls experiment-based feature rollouts.
   *  `true`: ABTestingModule is loaded, A/B experiments can run.
   *  `false`: ABTestingModule is skipped, all users receive default experience.
   *  Default: false (not yet GA). */
  ENABLE_AB_TESTING: boolean;

  /** Gates the DataWarehouseModule — controls analytics data pipelines.
   *  `true`: DataWarehouseModule is loaded, data pipeline jobs execute.
   *  `false`: DataWarehouseModule is skipped, no warehouse ingestion runs.
   *  Default: false (not yet GA). */
  ENABLE_DATA_WAREHOUSE: boolean;

  /** Gates the CollaborationModule — controls real-time collaboration features.
   *  `true`: CollaborationModule is loaded (WebSocket channels, shared editing).
   *  `false`: CollaborationModule is skipped. */
  ENABLE_COLLABORATION: boolean;

  /** Gates the MediaModule — controls file upload and media processing.
   *  `true`: MediaModule is loaded, upload/transcoding endpoints available.
   *  `false`: MediaModule is skipped. */
  ENABLE_MEDIA_PROCESSING: boolean;

  /** Gates the BackupModule — controls automated data backup routines.
   *  `true`: BackupModule is loaded, scheduled backups execute.
   *  `false`: BackupModule is skipped, no automated backups. */
  ENABLE_BACKUP: boolean;

  /** Gates the GraphQLModule — controls the GraphQL API layer.
   *  `true`: GraphQLModule is loaded, GraphQL playground and resolvers available.
   *  `false`: GraphQLModule is skipped, only REST API available.
   *  Default: false (not yet GA). */
  ENABLE_GRAPHQL: boolean;

  /** Gates the SyncModule — controls cross-device data synchronization.
   *  `true`: SyncModule is loaded.
   *  `false`: SyncModule is skipped. */
  ENABLE_SYNC: boolean;

  /** Gates the MigrationModule — controls database schema migrations.
   *  `true`: MigrationModule is loaded, migration runner available.
   *  `false`: MigrationModule is skipped. */
  ENABLE_MIGRATIONS: boolean;

  /** Gates the RateLimitingModule — controls per-route request throttling.
   *  `true`: RateLimitingModule is loaded, advanced rate-limit rules active.
   *  `false`: RateLimitingModule is skipped (basic ThrottlerModule still active). */
  ENABLE_RATE_LIMITING: boolean;

  /** Gates the ObservabilityModule — controls distributed tracing and metrics.
   *  `true`: ObservabilityModule is loaded, traces and custom metrics exported.
   *  `false`: ObservabilityModule is skipped. */
  ENABLE_OBSERVABILITY: boolean;

  /** Gates the CachingModule — controls application-level caching layer.
   *  `true`: CachingModule is loaded, cache decorators and interceptors active.
   *  `false`: CachingModule is skipped. */
  ENABLE_CACHING: boolean;

  /** Gates the FeatureFlagsModule — controls runtime feature flag management UI/API.
   *  `true`: FeatureFlagsModule is loaded, flag CRUD endpoints available.
   *  `false`: FeatureFlagsModule is skipped; flags are still read from env/config. */
  ENABLE_FEATURE_FLAGS: boolean;

  /** Gates the SearchModule — controls Elasticsearch-based full-text search.
   *  `true`: SearchModule is loaded, search endpoints available.
   *  `false`: SearchModule is skipped. */
  ENABLE_SEARCH: boolean;

  /** Gates the NotificationsModule — controls push/email/in-app notifications.
   *  `true`: NotificationsModule is loaded, notification dispatch active.
   *  `false`: NotificationsModule is skipped. */
  ENABLE_NOTIFICATIONS: boolean;

  /** Gates the EmailMarketingModule — controls SendGrid-based email campaigns.
   *  `true`: EmailMarketingModule is loaded, campaign scheduling available.
   *  `false`: EmailMarketingModule is skipped. */
  ENABLE_EMAIL_MARKETING: boolean;

  /** Gates the GamificationModule — controls points, badges, and leaderboards.
   *  `true`: GamificationModule is loaded, gamification tracking active.
   *  `false`: GamificationModule is skipped. */
  ENABLE_GAMIFICATION: boolean;

  /** Gates the AssessmentModule — controls quizzes and assessment features.
   *  `true`: AssessmentModule is loaded, assessment endpoints available.
   *  `false`: AssessmentModule is skipped. */
  ENABLE_ASSESSMENT: boolean;

  /** Gates the LearningPathsModule — controls structured learning sequences.
   *  `true`: LearningPathsModule is loaded, learning path CRUD available.
   *  `false`: LearningPathsModule is skipped. */
  ENABLE_LEARNING_PATHS: boolean;

  /** Gates the ModerationModule — controls content moderation workflows.
   *  `true`: ModerationModule is loaded, moderation queue active.
   *  `false`: ModerationModule is skipped. */
  ENABLE_MODERATION: boolean;

  /** Gates the OrchestrationModule — controls workflow orchestration.
   *  `true`: OrchestrationModule is loaded, orchestration engine active.
   *  `false`: OrchestrationModule is skipped. */
  ENABLE_ORCHESTRATION: boolean;

  /** Gates the SecurityModule — controls advanced security features.
   *  `true`: SecurityModule is loaded, CSRF/XSS/header hardening active.
   *  `false`: SecurityModule is skipped. */
  ENABLE_SECURITY: boolean;

  /** Gates the TenancyModule — controls multi-tenant isolation.
   *  `true`: TenancyModule is loaded, tenant resolution middleware active.
   *  `false`: TenancyModule is skipped. */
  ENABLE_TENANCY: boolean;

  /** Gates the CDNModule — controls CDN/CloudFront asset delivery.
   *  `true`: CDNModule is loaded, signed-URL generation available.
   *  `false`: CDNModule is skipped. */
  ENABLE_CDN: boolean;

  /** Gates the LocalizationModule — controls i18n/l10n support.
   *  `true`: LocalizationModule is loaded, locale negotiation active.
   *  `false`: LocalizationModule is skipped. */
  ENABLE_LOCALIZATION: boolean;

  /** Gates the OnboardingModule — controls user onboarding flow.
   *  `true`: OnboardingModule is loaded, onboarding endpoints available.
   *  `false`: OnboardingModule is skipped. */
  ENABLE_ONBOARDING: boolean;
}

/**
 * Default feature flags - all features enabled by default
 * except AB_TESTING, DATA_WAREHOUSE, and GRAPHQL which are not yet GA
 */
export const defaultFeatureFlags: IFeatureFlagsConfig = {
  ENABLE_AUTH: true,
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
  ENABLE_LOCALIZATION: true,
  ENABLE_ONBOARDING: true,
};

/**
 * Load feature flags from environment variables
 */
export function loadFeatureFlags(): IFeatureFlagsConfig {
  return {
    ENABLE_AUTH: getBooleanEnv('ENABLE_AUTH', defaultFeatureFlags.ENABLE_AUTH),
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
    ENABLE_LOCALIZATION: getBooleanEnv(
      'ENABLE_LOCALIZATION',
      defaultFeatureFlags.ENABLE_LOCALIZATION,
    ),
    ENABLE_ONBOARDING: getBooleanEnv('ENABLE_ONBOARDING', defaultFeatureFlags.ENABLE_ONBOARDING),
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
export function getEnabledModules(flags: IFeatureFlagsConfig): string[] {
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
  if (flags.ENABLE_LOCALIZATION) modules.push('LocalizationModule');
  if (flags.ENABLE_ONBOARDING) modules.push('OnboardingModule');

  return modules;
}

/**
 * Get list of disabled modules based on feature flags
 */
export function getDisabledModules(flags: IFeatureFlagsConfig): string[] {
  const allModules = Object.keys(defaultFeatureFlags)
    .filter((key) => key.startsWith('ENABLE_'))
    .map((key) => `${key.replace('ENABLE_', '')}Module`);

  const enabledModules = getEnabledModules(flags);

  return allModules.filter((module) => !enabledModules.includes(module));
}
