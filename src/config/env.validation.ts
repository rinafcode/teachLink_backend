import * as Joi from 'joi';
export const envValidationSchema = Joi.object({
  // Node Environment
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  // Database Configuration
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().required(),
  DATABASE_REPLICA_HOSTS: Joi.string().required(),
  DATABASE_REPLICA_PORT: Joi.number().required(),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).default(30),
  DATABASE_POOL_MIN: Joi.number().integer().min(0).default(5),
  DATABASE_POOL_ACQUIRE_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
  DATABASE_POOL_IDLE_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),

  // Redis Configuration
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().required(),

  // JWT Configuration
  JWT_SECRETS: Joi.string().optional(),
  JWT_SECRET_CURRENT_VERSION: Joi.string().optional(),
  JWT_SECRET: Joi.string()
    .min(10)
    .when('JWT_SECRETS', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(10).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Encryption
  ENCRYPTION_SECRET: Joi.string().min(32).required(),

  // Security Configuration
  BCRYPT_ROUNDS: Joi.number().integer().min(4).max(15).default(10),

  // Stripe Configuration
  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_WEBHOOK_SECRET: Joi.string().required(),
  STRIPE_HEALTH_URL: Joi.string().uri().optional(),

  // SMTP Email Configuration
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().required(),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().required(),
  SMTP_PASS: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),
  EMAIL_FROM_NAME: Joi.string().default('TeachLink'),

  // AWS Configuration
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_S3_BUCKET: Joi.string().required(),
  AWS_S3_BUCKET_NAME: Joi.string().optional(),
  AWS_S3_BUCKET_SECONDARY: Joi.string().optional(),
  AWS_KMS_KEY_ID: Joi.string().optional(),
  AWS_CLOUDFRONT_DISTRIBUTION_ID: Joi.string().optional(),
  AWS_HEALTH_URL: Joi.string().uri().optional(),

  // SendGrid Configuration
  SENDGRID_API_KEY: Joi.string().required(),
  SENDGRID_HEALTH_URL: Joi.string().uri().optional(),

  // Elasticsearch Configuration
  ELASTICSEARCH_NODE: Joi.string().uri().default('http://localhost:9200'),
  ELASTICSEARCH_USERNAME: Joi.string().optional(),
  ELASTICSEARCH_PASSWORD: Joi.string().optional(),
  ELASTICSEARCH_API_KEY: Joi.string().optional(),
  ELASTICSEARCH_CA_FINGERPRINT: Joi.string().optional(),
  ELASTICSEARCH_REQUEST_TIMEOUT: Joi.number().integer().default(30000),
  ELASTICSEARCH_MAX_RETRIES: Joi.number().integer().default(3),

  // Rate Limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(10),

  // Session Configuration
  SESSION_SECRET: Joi.string().min(10).required(),
  SESSION_COOKIE_NAME: Joi.string().default('teachlink.sid'),
  SESSION_PREFIX: Joi.string().default('sess:'),
  SESSION_TTL_SECONDS: Joi.number().integer().default(604800),
  SESSION_COOKIE_MAX_AGE_MS: Joi.number().integer().default(604800000),
  SESSION_LOCK_TTL_MS: Joi.number().integer().default(5000),
  SESSION_LOCK_MAX_RETRIES: Joi.number().integer().default(5),
  SESSION_LOCK_RETRY_DELAY_MS: Joi.number().integer().default(120),
  STICKY_SESSIONS_REQUIRED: Joi.boolean().default(true),
  TRUST_PROXY: Joi.boolean().default(true),

  // Feature Flags
  ENABLE_AUTH: Joi.boolean().default(true),

  ENABLE_PAYMENTS: Joi.boolean().default(true),
  ENABLE_AB_TESTING: Joi.boolean().default(false),
  ENABLE_DATA_WAREHOUSE: Joi.boolean().default(false),
  ENABLE_COLLABORATION: Joi.boolean().default(true),
  ENABLE_MEDIA_PROCESSING: Joi.boolean().default(true),
  ENABLE_BACKUP: Joi.boolean().default(true),
  ENABLE_GRAPHQL: Joi.boolean().default(false),
  ENABLE_SYNC: Joi.boolean().default(true),
  ENABLE_MIGRATIONS: Joi.boolean().default(true),
  ENABLE_RATE_LIMITING: Joi.boolean().default(true),
  ENABLE_OBSERVABILITY: Joi.boolean().default(true),
  ENABLE_CACHING: Joi.boolean().default(true),
  ENABLE_FEATURE_FLAGS: Joi.boolean().default(true),
  ENABLE_SEARCH: Joi.boolean().default(true),
  ENABLE_NOTIFICATIONS: Joi.boolean().default(true),
  ENABLE_EMAIL_MARKETING: Joi.boolean().default(true),
  ENABLE_GAMIFICATION: Joi.boolean().default(true),
  ENABLE_ASSESSMENT: Joi.boolean().default(true),
  ENABLE_LEARNING_PATHS: Joi.boolean().default(true),
  ENABLE_MODERATION: Joi.boolean().default(true),
  ENABLE_ORCHESTRATION: Joi.boolean().default(true),
  ENABLE_SECURITY: Joi.boolean().default(true),
  ENABLE_TENANCY: Joi.boolean().default(true),
  ENABLE_CDN: Joi.boolean().default(true),
  ENABLE_LOCALIZATION: Joi.boolean().default(true),
  // TODO: ENABLE_MALWARE_SCANNING is used in media/validation/malware-scanning.service.ts
  // but is not defined in feature-flags.config.ts — add it there or migrate to ConfigService only
  ENABLE_MALWARE_SCANNING: Joi.boolean().default(false),

  // i18n / localization
  I18N_DEFAULT_LOCALE: Joi.string().default('en'),
  I18N_SUPPORTED_LOCALES: Joi.string().default('en'),
  I18N_CACHE_TTL_SECONDS: Joi.number().integer().min(0).default(300),

  // Cluster Mode
  CLUSTER_MODE: Joi.boolean().default(false),
  CLUSTER_WORKERS: Joi.number().integer().min(1).default(4),

  // Application URL
  APP_URL: Joi.string().uri().default('http://localhost:3000'),

  // CORS Configuration
  CORS_ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000,http://localhost:4000'),

  // Secrets Management
  SECRET_CACHE_TTL_MS: Joi.number().integer().min(1000).default(300000),
  SECRETS_TO_ROTATE: Joi.string().optional(),
  VAULT_ADDR: Joi.string().uri().optional(),
  VAULT_TOKEN: Joi.string().optional(),
  VAULT_SECRET_PATH: Joi.string().default('secret/data'),
  SECRET_PROVIDER: Joi.string().valid('aws', 'vault', 'env').default('env'),

  // Idempotency Configuration
  IDEMPOTENCY_TTL_SECONDS: Joi.number().integer().min(60).default(86400),

  // Circuit Breaker Configuration
  CIRCUIT_BREAKER_TIMEOUT_MS: Joi.number().integer().min(100).default(3000),
  CIRCUIT_BREAKER_ERROR_THRESHOLD: Joi.number().integer().min(1).max(100).default(50),
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  CIRCUIT_BREAKER_ROLLING_COUNT_TIMEOUT: Joi.number().integer().min(1000).default(60000),
  CIRCUIT_BREAKER_ROLLING_COUNT_BUCKETS: Joi.number().integer().min(1).default(10),
});
