import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Node Environment
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  // Database Configuration
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().required(),
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
  JWT_SECRET: Joi.string().min(10).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(10).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Encryption
  ENCRYPTION_SECRET: Joi.string().min(32).required(),

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
  ENABLE_SESSION_MANAGEMENT: Joi.boolean().default(true),
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

  // Cluster Mode
  CLUSTER_MODE: Joi.boolean().default(false),
  CLUSTER_WORKERS: Joi.number().integer().min(1).default(4),

  // Application URL
  APP_URL: Joi.string().uri().default('http://localhost:3000'),
});
