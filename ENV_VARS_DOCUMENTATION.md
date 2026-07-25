# Environment Variables Documentation

Complete reference for all environment variables used in TeachLink Backend.

---

## Table of Contents

1. [Core Application](#core-application)
2. [Database Configuration](#database-configuration)
3. [Authentication & Security](#authentication--security)
4. [External Services](#external-services)
5. [Storage & CDN](#storage--cdn)
6. [Messaging & Notifications](#messaging--notifications)
7. [Monitoring & Observability](#monitoring--observability)
8. [Session Management](#session-management)
9. [Feature Flags](#feature-flags)
10. [Performance & Limits](#performance--limits)
11. [Secrets Management](#secrets-management)

---

## Core Application

### NODE_ENV
- **Status:** Optional
- **Default:** `development`
- **Valid Values:** `development`, `production`, `test`, `staging`
- **Type:** String
- **Description:** Sets the application runtime environment
- **Impact:** Controls logging level, error handling, security settings, and synchronization behavior
- **Examples:**
  - Development: `NODE_ENV=development` (verbose logging, auto-sync enabled)
  - Production: `NODE_ENV=production` (minimal logging, strict security)
  - Staging: `NODE_ENV=staging` (test-like setup with production DB)

### PORT
- **Status:** Optional
- **Default:** `3000`
- **Valid Range:** 1-65535
- **Type:** Integer
- **Description:** Port on which the application listens
- **Examples:**
  - `PORT=3000` (default)
  - `PORT=8080` (alternative port)
  - `PORT=443` (HTTPS, requires reverse proxy)

### APP_URL
- **Status:** Optional
- **Default:** `http://localhost:3000`
- **Type:** URL/String
- **Description:** Public URL for the application (used for links in emails, redirects, etc.)
- **Examples:**
  - Local: `APP_URL=http://localhost:3000`
  - Staging: `APP_URL=https://staging.teachlink.io`
  - Production: `APP_URL=https://api.teachlink.io`

### SERVICE_NAME
- **Status:** Optional
- **Default:** `teachlink-backend`
- **Type:** String
- **Description:** Service identifier for logging and monitoring
- **Examples:**
  - `SERVICE_NAME=teachlink-backend-prod`
  - `SERVICE_NAME=teachlink-backend-staging`

### SHUTDOWN_TIMEOUT_MS
- **Status:** Optional
- **Default:** `30000` (30 seconds)
- **Valid Range:** 5000-120000 ms
- **Type:** Integer
- **Description:** Graceful shutdown timeout for active connections
- **Examples:**
  - `SHUTDOWN_TIMEOUT_MS=30000` (default)
  - `SHUTDOWN_TIMEOUT_MS=60000` (longer timeout for heavy workloads)

### CLUSTER_MODE
- **Status:** Optional
- **Default:** `false`
- **Valid Values:** `true`, `false`
- **Type:** Boolean
- **Description:** Enable cluster mode for multi-worker deployment
- **Impact:** When enabled, spawns multiple worker processes
- **Examples:**
  - `CLUSTER_MODE=true` (enable)
  - `CLUSTER_MODE=false` (single process)

### CLUSTER_WORKERS
- **Status:** Optional
- **Default:** Number of CPU cores
- **Valid Range:** 1+
- **Type:** Integer
- **Description:** Number of worker processes in cluster mode
- **Examples:**
  - `CLUSTER_WORKERS=4` (manual setting)
  - Leave unset for auto-detection

---

## Database Configuration

### DATABASE_HOST
- **Status:** Required
- **Type:** String (hostname or IP)
- **Description:** PostgreSQL primary database host
- **Examples:**
  - Local: `DATABASE_HOST=localhost`
  - Production: `DATABASE_HOST=db.internal`
  - AWS RDS: `DATABASE_HOST=prod-db.c9akciq32.us-east-1.rds.amazonaws.com`

### DATABASE_PORT
- **Status:** Required
- **Default:** Not applied (must be explicitly set)
- **Valid Range:** 1-65535
- **Type:** Integer
- **Description:** PostgreSQL port
- **Examples:**
  - Standard: `DATABASE_PORT=5432`
  - Non-standard: `DATABASE_PORT=5433`

### DATABASE_USER
- **Status:** Required
- **Type:** String
- **Description:** PostgreSQL username for primary database
- **Security Note:** Use strong credentials in production
- **Examples:**
  - `DATABASE_USER=postgres` (local/dev)
  - `DATABASE_USER=teachlink_prod` (production)

### DATABASE_PASSWORD
- **Status:** Required
- **Type:** String
- **Description:** PostgreSQL password for primary database
- **Security Note:** Use AWS Secrets Manager or HashiCorp Vault in production
- **Examples:**
  - Minimum complexity recommended for production

### DATABASE_NAME
- **Status:** Required
- **Type:** String
- **Description:** Primary database name
- **Examples:**
  - `DATABASE_NAME=teachlink` (development)
  - `DATABASE_NAME=teachlink_staging` (staging)
  - `DATABASE_NAME=teachlink_prod` (production)

### DATABASE_POOL_MAX
- **Status:** Optional
- **Default:** `30`
- **Valid Range:** 1+
- **Type:** Integer
- **Description:** Maximum number of database connections in pool
- **Guidelines:**
  - Small apps: 5-10
  - Medium apps: 10-30
  - Large apps: 30-100
- **Examples:**
  - `DATABASE_POOL_MAX=30` (default)
  - `DATABASE_POOL_MAX=50` (high traffic)

### DATABASE_POOL_MIN
- **Status:** Optional
- **Default:** `5`
- **Valid Range:** 0+
- **Type:** Integer
- **Description:** Minimum number of pre-allocated database connections
- **Guidelines:** Typically 20-30% of pool max
- **Examples:**
  - `DATABASE_POOL_MIN=5` (default)
  - `DATABASE_POOL_MIN=10` (pre-warm connections)

### DATABASE_POOL_ACQUIRE_TIMEOUT_MS
- **Status:** Optional
- **Default:** `10000` (10 seconds)
- **Valid Range:** 1000-60000 ms
- **Type:** Integer
- **Description:** Timeout waiting for available connection from pool
- **Examples:**
  - `DATABASE_POOL_ACQUIRE_TIMEOUT_MS=10000` (default)
  - `DATABASE_POOL_ACQUIRE_TIMEOUT_MS=5000` (faster timeout)

### DATABASE_POOL_IDLE_TIMEOUT_MS
- **Status:** Optional
- **Default:** `30000` (30 seconds)
- **Valid Range:** 1000-300000 ms
- **Type:** Integer
- **Description:** Time before idle connections are closed
- **Examples:**
  - `DATABASE_POOL_IDLE_TIMEOUT_MS=30000` (default)
  - `DATABASE_POOL_IDLE_TIMEOUT_MS=60000` (keep connections longer)

### DATABASE_POOL_LEAK_THRESHOLD_MS
- **Status:** Optional
- **Default:** `60000` (60 seconds)
- **Valid Range:** 5000-300000 ms
- **Type:** Integer
- **Description:** Log warning if connection held longer than threshold
- **Examples:**
  - `DATABASE_POOL_LEAK_THRESHOLD_MS=60000`

### DATABASE_REPLICA_HOSTS
- **Status:** Optional
- **Type:** Comma-separated string
- **Description:** Read replica host names (comma-separated)
- **Note:** If set, queries can be routed to replicas
- **Examples:**
  - `DATABASE_REPLICA_HOSTS=replica-1.local,replica-2.local,replica-3.local`
  - Leave empty to disable replicas

### DATABASE_REPLICA_PORT
- **Status:** Optional
- **Default:** Same as DATABASE_PORT
- **Type:** Integer
- **Description:** Port for replica connections
- **Examples:**
  - `DATABASE_REPLICA_PORT=5432`

### DATABASE_REPLICA_USER
- **Status:** Optional
- **Type:** String
- **Description:** Username for read replica connections
- **Default:** Falls back to DATABASE_USER
- **Examples:**
  - `DATABASE_REPLICA_USER=teachlink_ro` (read-only user)

### DATABASE_REPLICA_PASSWORD
- **Status:** Optional
- **Type:** String
- **Description:** Password for read replica connections
- **Default:** Falls back to DATABASE_PASSWORD

### DATABASE_REPLICA_NAME
- **Status:** Optional
- **Type:** String
- **Description:** Database name for replicas
- **Default:** Falls back to DATABASE_NAME

### DB_DRAIN_TIMEOUT_MS
- **Status:** Optional
- **Default:** `15000` (15 seconds)
- **Type:** Integer
- **Description:** Grace period before force-closing connections on shutdown

### DB_FORCE_CLOSE_TIMEOUT_MS
- **Status:** Optional
- **Default:** `5000` (5 seconds)
- **Type:** Integer
- **Description:** Hard timeout for connection closure

### DB_WAIT_FOR_QUERIES
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Wait for active queries to complete before shutdown

---

## Authentication & Security

### JWT_SECRET
- **Status:** Required
- **Minimum Length:** 10 characters (32+ recommended)
- **Type:** String
- **Description:** Secret key for JWT signing (for token-based auth)
- **Security Note:** Use minimum 32 characters in production
- **Examples:**
  - Dev: `JWT_SECRET=dev-secret-key-123`
  - Prod: `JWT_SECRET=<use-aws-secrets-manager>`
- **Rotation:** Can be rotated using JWT_SECRETS (comma-separated keys)

### JWT_SECRETS
- **Status:** Optional
- **Type:** Comma-separated string
- **Description:** Multiple JWT secrets for key rotation (current key first)
- **Examples:**
  - `JWT_SECRETS=new-secret-key,old-secret-key`
- **Note:** When set, JWT_SECRET becomes optional

### JWT_EXPIRES_IN
- **Status:** Optional
- **Default:** `15m`
- **Type:** String (with unit: s, m, h, d)
- **Description:** JWT token expiration time
- **Examples:**
  - `JWT_EXPIRES_IN=15m` (15 minutes)
  - `JWT_EXPIRES_IN=1h` (1 hour)
  - `JWT_EXPIRES_IN=900` (900 seconds)

### JWT_REFRESH_SECRET
- **Status:** Required
- **Minimum Length:** 10 characters (32+ recommended)
- **Type:** String
- **Description:** Secret for refresh token signing
- **Security Note:** Must be different from JWT_SECRET

### JWT_REFRESH_EXPIRES_IN
- **Status:** Optional
- **Default:** `7d`
- **Type:** String (with unit)
- **Description:** Refresh token expiration time
- **Examples:**
  - `JWT_REFRESH_EXPIRES_IN=7d` (7 days)
  - `JWT_REFRESH_EXPIRES_IN=30d` (30 days)

### ENCRYPTION_SECRET
- **Status:** Required
- **Minimum Length:** 32 characters
- **Type:** String
- **Description:** 32-character secret for data encryption
- **Security Note:** Must be exactly 32 characters (or multiple of 16 for AES-256)
- **Examples:**
  - Must be 32 chars: `ENCRYPTION_SECRET=0123456789abcdef0123456789abcdef`

### BCRYPT_ROUNDS
- **Status:** Optional
- **Default:** `10`
- **Valid Range:** 4-15
- **Type:** Integer
- **Description:** Number of rounds for bcrypt password hashing
- **Guidelines:**
  - 4-6 rounds: Fast (suitable for testing)
  - 10-12 rounds: Balanced (recommended)
  - 13-15 rounds: Slow (high security, slower login)
- **Examples:**
  - `BCRYPT_ROUNDS=10` (default, balanced)
  - `BCRYPT_ROUNDS=12` (production, more secure)
  - `BCRYPT_ROUNDS=4` (testing only)

### AUTH0_AUDIENCE
- **Status:** Optional
- **Type:** URL
- **Description:** Auth0 API audience identifier
- **Examples:**
  - `AUTH0_AUDIENCE=https://api.teachlink.io`

### AUTH0_ISSUER_URL
- **Status:** Optional
- **Type:** URL
- **Description:** Auth0 issuer URL
- **Examples:**
  - `AUTH0_ISSUER_URL=https://teachlink.auth0.com/`

---

## External Services

### SMTP_HOST
- **Status:** Required
- **Type:** String (hostname or IP)
- **Description:** SMTP server for email sending
- **Examples:**
  - Development: `SMTP_HOST=localhost` (with Mailhog/similar)
  - Production: `SMTP_HOST=smtp.sendgrid.net` or `smtp.mailtrap.io`

### SMTP_PORT
- **Status:** Required
- **Valid Range:** 1-65535
- **Type:** Integer
- **Description:** SMTP server port
- **Common Values:**
  - 25 (unencrypted)
  - 587 (TLS)
  - 465 (SSL/implicit TLS)
- **Examples:**
  - `SMTP_PORT=587` (TLS, most common)
  - `SMTP_PORT=465` (SSL)

### SMTP_SECURE
- **Status:** Optional
- **Default:** `false`
- **Valid Values:** `true`, `false`
- **Type:** Boolean
- **Description:** Use SSL/TLS for SMTP connection
- **Examples:**
  - `SMTP_SECURE=false` (port 587 with STARTTLS)
  - `SMTP_SECURE=true` (port 465 with implicit TLS)

### SMTP_USER
- **Status:** Required
- **Type:** String
- **Description:** SMTP authentication username
- **Examples:**
  - `SMTP_USER=noreply@teachlink.io`
  - `SMTP_USER=api_user_123`

### SMTP_PASS
- **Status:** Required
- **Type:** String
- **Description:** SMTP authentication password
- **Security Note:** Use AWS Secrets Manager in production

### EMAIL_FROM
- **Status:** Required
- **Type:** Email address
- **Description:** Default "from" email address
- **Examples:**
  - `EMAIL_FROM=noreply@teachlink.io`
  - `EMAIL_FROM=support@teachlink.io`

### EMAIL_FROM_NAME
- **Status:** Optional
- **Default:** `TeachLink`
- **Type:** String
- **Description:** Display name for email sender
- **Examples:**
  - `EMAIL_FROM_NAME=TeachLink Support`

### SENDGRID_API_KEY
- **Status:** Required
- **Type:** String
- **Description:** SendGrid API key for email service
- **Security Note:** Use AWS Secrets Manager in production
- **Examples:**
  - `SENDGRID_API_KEY=SG.xxxxxxxxxxxxx`

### SENDGRID_HEALTH_URL
- **Status:** Optional
- **Default:** `https://api.sendgrid.com/v3/health`
- **Type:** URL
- **Description:** SendGrid health check endpoint
- **Note:** Used for service health monitoring

### STRIPE_SECRET_KEY
- **Status:** Required
- **Type:** String
- **Description:** Stripe secret API key
- **Security Note:** Use AWS Secrets Manager in production
- **Examples:**
  - Development: `STRIPE_SECRET_KEY=sk_test_...`
  - Production: `STRIPE_SECRET_KEY=sk_live_...`

### STRIPE_WEBHOOK_SECRET
- **Status:** Required
- **Type:** String
- **Description:** Stripe webhook signing secret
- **Security Note:** Found in Stripe dashboard > Webhooks
- **Examples:**
  - `STRIPE_WEBHOOK_SECRET=whsec_...`

### STRIPE_HEALTH_URL
- **Status:** Optional
- **Default:** `https://api.stripe.com/v1/balance`
- **Type:** URL
- **Description:** Stripe health check endpoint

---

## Storage & CDN

### AWS_ACCESS_KEY_ID
- **Status:** Required
- **Type:** String
- **Description:** AWS IAM access key ID
- **Security Note:** Use IAM role in production instead
- **Examples:**
  - `AWS_ACCESS_KEY_ID=AKIA...`

### AWS_SECRET_ACCESS_KEY
- **Status:** Required
- **Type:** String
- **Description:** AWS IAM secret access key
- **Security Note:** Use AWS Secrets Manager or IAM role in production

### AWS_REGION
- **Status:** Optional
- **Default:** `us-east-1`
- **Type:** String
- **Description:** AWS region for S3, SQS, SNS services
- **Valid Values:** Any AWS region code
- **Examples:**
  - `AWS_REGION=us-east-1` (default)
  - `AWS_REGION=eu-west-1` (Europe)

### AWS_S3_BUCKET
- **Status:** Required
- **Type:** String
- **Description:** S3 bucket for file storage
- **Examples:**
  - `AWS_S3_BUCKET=teachlink-dev`
  - `AWS_S3_BUCKET=teachlink-prod`

### AWS_S3_BUCKET_NAME
- **Status:** Optional
- **Type:** String
- **Description:** Alternative S3 bucket name (fallback)

### AWS_S3_BUCKET_SECONDARY
- **Status:** Optional
- **Type:** String
- **Description:** Secondary S3 bucket for backups/replicas

### AWS_KMS_KEY_ID
- **Status:** Optional
- **Type:** String (KMS key ARN or alias)
- **Description:** KMS key for S3 encryption
- **Examples:**
  - `AWS_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789:key/12345678-...`
  - `AWS_KMS_KEY_ID=alias/teachlink-prod`

### AWS_CLOUDFRONT_DISTRIBUTION_ID
- **Status:** Optional
- **Type:** String
- **Description:** CloudFront distribution ID for CDN cache invalidation
- **Examples:**
  - `AWS_CLOUDFRONT_DISTRIBUTION_ID=E123ABCDEF`

### AWS_SQS_NOTIFICATION_QUEUE_URL
- **Status:** Optional
- **Type:** URL
- **Description:** SQS queue for notifications
- **Examples:**
  - `AWS_SQS_NOTIFICATION_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/teachlink-notifications`

### AWS_SNS_NOTIFICATION_TOPIC_ARN
- **Status:** Optional
- **Type:** ARN
- **Description:** SNS topic for notifications
- **Examples:**
  - `AWS_SNS_NOTIFICATION_TOPIC_ARN=arn:aws:sns:us-east-1:123456789:teachlink-notifications`

### AWS_HEALTH_URL
- **Status:** Optional
- **Default:** `https://sts.amazonaws.com`
- **Type:** URL
- **Description:** AWS health check endpoint

### CDN_ENABLED
- **Status:** Optional
- **Default:** `false`
- **Valid Values:** `true`, `false`
- **Type:** Boolean
- **Description:** Enable CDN for static assets

### CDN_DOMAIN
- **Status:** Optional (required if CDN_ENABLED=true)
- **Type:** String (domain name)
- **Description:** CDN domain for static assets
- **Examples:**
  - `CDN_DOMAIN=cdn.teachlink.io`
  - `CDN_DOMAIN=d111111abcdef8.cloudfront.net`

### CDN_IMMUTABLE_MAX_AGE
- **Status:** Optional
- **Default:** `31536000` (1 year in seconds)
- **Type:** Integer (seconds)
- **Description:** Cache duration for immutable assets (versioned)

### CDN_HTML_MAX_AGE
- **Status:** Optional
- **Default:** `300` (5 minutes)
- **Type:** Integer (seconds)
- **Description:** Cache duration for HTML files (should be short)

### CDN_SWR
- **Status:** Optional
- **Default:** `60` (1 minute)
- **Type:** Integer (seconds)
- **Description:** Stale-While-Revalidate duration

---

## Messaging & Notifications

### REDIS_HOST
- **Status:** Required
- **Type:** String (hostname or IP)
- **Description:** Redis server for caching and job queue
- **Examples:**
  - Local: `REDIS_HOST=localhost`
  - Production: `REDIS_HOST=redis.internal`

### REDIS_PORT
- **Status:** Required
- **Default:** Not applied (must be explicitly set)
- **Valid Range:** 1-65535
- **Type:** Integer
- **Description:** Redis port
- **Examples:**
  - `REDIS_PORT=6379` (default)

### REDIS_URL
- **Status:** Optional
- **Type:** URL
- **Description:** Full Redis URL (alternative to REDIS_HOST/PORT)
- **Format:** `redis://[user:password@]host:port[/db]`
- **Examples:**
  - `REDIS_URL=redis://localhost:6379`
  - `REDIS_URL=redis://:password@redis.internal:6379/1`

### QUEUE_REDIS_URL
- **Status:** Optional
- **Type:** URL
- **Description:** Separate Redis URL for Bull job queue
- **Examples:**
  - `QUEUE_REDIS_URL=redis://localhost:6379/1` (use different DB)

### SLACK_WEBHOOK_URL
- **Status:** Optional
- **Type:** URL
- **Description:** Slack incoming webhook for notifications
- **Examples:**
  - `SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK`

### ALERT_SLACK_WEBHOOK_URL
- **Status:** Optional
- **Type:** URL
- **Description:** Slack webhook for alert notifications (may differ from SLACK_WEBHOOK_URL)

### ALERT_EMAIL_RECIPIENTS
- **Status:** Optional
- **Type:** Comma-separated email addresses
- **Description:** Email addresses for alert notifications
- **Examples:**
  - `ALERT_EMAIL_RECIPIENTS=ops@teachlink.io,oncall@teachlink.io`

### PAGERDUTY_INTEGRATION_KEY
- **Status:** Optional
- **Type:** String
- **Description:** PagerDuty integration key for incident management

---

## Monitoring & Observability

### ELASTICSEARCH_NODE
- **Status:** Optional
- **Default:** `http://localhost:9200`
- **Type:** URL
- **Description:** Elasticsearch endpoint for log aggregation
- **Examples:**
  - Local: `ELASTICSEARCH_NODE=http://localhost:9200`
  - Production: `ELASTICSEARCH_NODE=https://elasticsearch.internal:9200`
  - AWS: `ELASTICSEARCH_NODE=https://domain-abc123.us-east-1.es.amazonaws.com`

### ELASTICSEARCH_USERNAME
- **Status:** Optional
- **Type:** String
- **Description:** Elasticsearch basic auth username
- **Note:** Use API key authentication instead in production

### ELASTICSEARCH_PASSWORD
- **Status:** Optional
- **Type:** String
- **Description:** Elasticsearch basic auth password
- **Security Note:** Use ELASTICSEARCH_API_KEY for cloud setups

### ELASTICSEARCH_API_KEY
- **Status:** Optional
- **Type:** String
- **Description:** Elasticsearch API key (preferred over basic auth)
- **Format:** `base64_encoded_key`
- **Examples:**
  - `ELASTICSEARCH_API_KEY=VnVhQ2ZHY0JDUDhwN2VER0...`

### ELASTICSEARCH_CA_FINGERPRINT
- **Status:** Optional
- **Type:** String
- **Description:** CA fingerprint for self-signed TLS certificates
- **Examples:**
  - `ELASTICSEARCH_CA_FINGERPRINT=d41d8cd98f00b204e9800998ecf8427e`

### ELASTICSEARCH_REQUEST_TIMEOUT
- **Status:** Optional
- **Default:** `30000` (30 seconds)
- **Type:** Integer (milliseconds)
- **Description:** Timeout for Elasticsearch requests

### ELASTICSEARCH_MAX_RETRIES
- **Status:** Optional
- **Default:** `3`
- **Type:** Integer
- **Description:** Max retries for failed Elasticsearch requests

### KIBANA_URL
- **Status:** Optional
- **Type:** URL
- **Description:** Kibana URL for log dashboard links
- **Examples:**
  - `KIBANA_URL=http://localhost:5601`
  - `KIBANA_URL=https://kibana.internal`

### METRICS_ENABLED
- **Status:** Optional
- **Default:** `true`
- **Valid Values:** `true`, `false`
- **Type:** Boolean
- **Description:** Enable Prometheus metrics endpoint (/metrics)

### METRICS_PATH
- **Status:** Optional
- **Default:** `/metrics`
- **Type:** String
- **Description:** Path for Prometheus metrics scrape endpoint

### METRICS_AUTH_TOKEN
- **Status:** Optional
- **Type:** String
- **Description:** Bearer token for /metrics endpoint authentication
- **Note:** Leave empty for internal-only networks

---

## Session Management

### SESSION_SECRET
- **Status:** Required
- **Minimum Length:** 10 characters (32+ recommended)
- **Type:** String
- **Description:** Secret for session encryption
- **Security Note:** Use 32+ character random string in production

### SESSION_COOKIE_NAME
- **Status:** Optional
- **Default:** `teachlink.sid`
- **Type:** String
- **Description:** Session cookie name
- **Examples:**
  - `SESSION_COOKIE_NAME=teachlink.sid`

### SESSION_PREFIX
- **Status:** Optional
- **Default:** `sess:`
- **Type:** String
- **Description:** Redis key prefix for session storage
- **Examples:**
  - `SESSION_PREFIX=sess:` (standard)
  - `SESSION_PREFIX=session:` (alternative)

### SESSION_TTL_SECONDS
- **Status:** Optional
- **Default:** `604800` (7 days)
- **Type:** Integer (seconds)
- **Description:** Session time-to-live
- **Examples:**
  - `SESSION_TTL_SECONDS=604800` (7 days)
  - `SESSION_TTL_SECONDS=86400` (1 day)

### SESSION_COOKIE_MAX_AGE_MS
- **Status:** Optional
- **Default:** `604800000` (7 days)
- **Type:** Integer (milliseconds)
- **Description:** Browser cookie max age
- **Note:** Should match SESSION_TTL_SECONDS

### SESSION_LOCK_TTL_MS
- **Status:** Optional
- **Default:** `5000` (5 seconds)
- **Type:** Integer (milliseconds)
- **Description:** Distributed lock timeout for session updates

### SESSION_LOCK_MAX_RETRIES
- **Status:** Optional
- **Default:** `5`
- **Type:** Integer
- **Description:** Max retries for acquiring session lock

### SESSION_LOCK_RETRY_DELAY_MS
- **Status:** Optional
- **Default:** `120` (120ms)
- **Type:** Integer (milliseconds)
- **Description:** Delay between session lock retry attempts

### STICKY_SESSIONS_REQUIRED
- **Status:** Optional
- **Default:** `true`
- **Valid Values:** `true`, `false`
- **Type:** Boolean
- **Description:** Require sticky sessions in load balancing
- **Note:** Set to false only if using distributed session store (Redis)

### TRUST_PROXY
- **Status:** Optional
- **Default:** `true`
- **Valid Values:** `true`, `false`
- **Type:** Boolean
- **Description:** Trust proxy headers (X-Forwarded-*)
- **Important:** Set to true when behind reverse proxy

---

## Feature Flags

All feature flags default to `true` unless otherwise noted.

### ENABLE_AUTH
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable authentication module (recommended: always true)

### ENABLE_SESSION_MANAGEMENT
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable session management (recommended: always true)

### ENABLE_PAYMENTS
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable Stripe payment processing

### ENABLE_AB_TESTING
- **Status:** Optional
- **Default:** `false`
- **Type:** Boolean
- **Description:** Enable A/B testing module

### ENABLE_DATA_WAREHOUSE
- **Status:** Optional
- **Default:** `false`
- **Type:** Boolean
- **Description:** Enable data warehouse features

### ENABLE_COLLABORATION
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable collaboration features

### ENABLE_MEDIA_PROCESSING
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable media/image processing

### ENABLE_BACKUP
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable backup functionality

### ENABLE_GRAPHQL
- **Status:** Optional
- **Default:** `false`
- **Type:** Boolean
- **Description:** Enable GraphQL API

### ENABLE_SYNC
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable data synchronization

### ENABLE_MIGRATIONS
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable database migrations

### ENABLE_RATE_LIMITING
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable API rate limiting

### ENABLE_OBSERVABILITY
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable observability/monitoring

### ENABLE_CACHING
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable caching layer

### ENABLE_FEATURE_FLAGS
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable feature flag management

### ENABLE_SEARCH
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable search functionality

### ENABLE_NOTIFICATIONS
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable notification system

### ENABLE_EMAIL_MARKETING
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable email marketing features

### ENABLE_GAMIFICATION
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable gamification features

### ENABLE_ASSESSMENT
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable assessment module

### ENABLE_LEARNING_PATHS
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable learning paths

### ENABLE_MODERATION
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable content moderation

### ENABLE_ORCHESTRATION
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable workflow orchestration

### ENABLE_SECURITY
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable security features

### ENABLE_TENANCY
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable multi-tenancy support

### ENABLE_CDN
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable CDN integration

### ENABLE_LOCALIZATION
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Enable i18n/localization

### ENABLE_MALWARE_SCANNING
- **Status:** Optional
- **Default:** `false`
- **Type:** Boolean
- **Description:** Enable malware scanning for uploads

---

## Performance & Limits

### REQUEST_BODY_LIMIT
- **Status:** Optional
- **Default:** `1mb`
- **Type:** String (with unit: b, kb, mb, gb)
- **Description:** Max request body size
- **Examples:**
  - `REQUEST_BODY_LIMIT=1mb` (default)
  - `REQUEST_BODY_LIMIT=10mb` (large payloads)
  - `REQUEST_BODY_LIMIT=512kb` (small requests)

### FILE_UPLOAD_MAX_BYTES
- **Status:** Optional
- **Default:** `10mb` (10,485,760 bytes)
- **Type:** Byte size
- **Description:** Maximum file upload size
- **Examples:**
  - `FILE_UPLOAD_MAX_BYTES=10485760` (10MB)
  - `FILE_UPLOAD_MAX_BYTES=52428800` (50MB)

### REQUEST_TIMEOUT
- **Status:** Optional
- **Default:** (application-specific)
- **Type:** Integer (milliseconds)
- **Description:** HTTP request timeout
- **Examples:**
  - `REQUEST_TIMEOUT=30000` (30 seconds)
  - `REQUEST_TIMEOUT=60000` (1 minute)

### DATABASE_TIMEOUT
- **Status:** Optional
- **Default:** (application-specific)
- **Type:** Integer (milliseconds)
- **Description:** Database query timeout

### THROTTLE_TTL
- **Status:** Optional
- **Default:** `60` (seconds)
- **Type:** Integer
- **Description:** Rate limiting window size

### THROTTLE_LIMIT
- **Status:** Optional
- **Default:** `10`
- **Type:** Integer
- **Description:** Max requests per THROTTLE_TTL window

### GRAPHQL_MAX_DEPTH
- **Status:** Optional
- **Default:** `10`
- **Type:** Integer
- **Description:** Max GraphQL query depth

### GRAPHQL_MAX_COMPLEXITY
- **Status:** Optional
- **Default:** `1000`
- **Type:** Integer
- **Description:** Max GraphQL query complexity score

### GRAPHQL_LIST_MULTIPLIER
- **Status:** Optional
- **Default:** `10`
- **Type:** Integer
- **Description:** Complexity multiplier for list fields

### IDEMPOTENCY_TTL_SECONDS
- **Status:** Optional
- **Default:** `86400` (24 hours)
- **Valid Range:** 60+ seconds
- **Type:** Integer
- **Description:** Cache duration for idempotency keys

---

## Secrets Management

### SECRET_PROVIDER
- **Status:** Optional
- **Default:** `env`
- **Valid Values:** `env`, `aws`, `vault`
- **Type:** String
- **Description:** Secrets backend provider
- **Examples:**
  - `SECRET_PROVIDER=env` (load from environment)
  - `SECRET_PROVIDER=aws` (AWS Secrets Manager)
  - `SECRET_PROVIDER=vault` (HashiCorp Vault)

### SECRET_CACHE_TTL_MS
- **Status:** Optional
- **Default:** `300000` (5 minutes)
- **Valid Range:** 1000+
- **Type:** Integer (milliseconds)
- **Description:** Cache TTL for secrets retrieved from manager

### SECRETS_TO_ROTATE
- **Status:** Optional
- **Type:** Comma-separated string
- **Description:** List of secret names to rotate
- **Examples:**
  - `SECRETS_TO_ROTATE=JWT_SECRET,DATABASE_PASSWORD`

### VAULT_ADDR
- **Status:** Optional (required if SECRET_PROVIDER=vault)
- **Type:** URL
- **Description:** HashiCorp Vault address
- **Examples:**
  - `VAULT_ADDR=https://vault.internal:8200`

### VAULT_TOKEN
- **Status:** Optional (required if SECRET_PROVIDER=vault)
- **Type:** String
- **Description:** HashiCorp Vault authentication token
- **Security Note:** Use IAM authentication in production

### VAULT_SECRET_PATH
- **Status:** Optional
- **Default:** `secret/data`
- **Type:** String
- **Description:** Base path for secrets in Vault
- **Examples:**
  - `VAULT_SECRET_PATH=secret/data/teachlink`

---

## Internationalization (i18n)

### I18N_DEFAULT_LOCALE
- **Status:** Optional
- **Default:** `en`
- **Type:** String (locale code)
- **Description:** Default language locale
- **Examples:**
  - `I18N_DEFAULT_LOCALE=en` (English)
  - `I18N_DEFAULT_LOCALE=es` (Spanish)

### I18N_SUPPORTED_LOCALES
- **Status:** Optional
- **Default:** `en`
- **Type:** Comma-separated string
- **Description:** Supported locales
- **Examples:**
  - `I18N_SUPPORTED_LOCALES=en,es,fr,de`

### I18N_CACHE_TTL_SECONDS
- **Status:** Optional
- **Default:** `300` (5 minutes)
- **Type:** Integer
- **Description:** Cache duration for translation strings

---

## Advanced Database Configuration

### INDEX_OPT_ENABLED
- **Status:** Optional
- **Default:** `false`
- **Type:** Boolean
- **Description:** Enable automatic index optimization

### INDEX_OPT_DRY_RUN
- **Status:** Optional
- **Default:** `true`
- **Type:** Boolean
- **Description:** Run index optimization in dry-run mode (no changes)

### INDEX_OPT_AUTO_CREATE
- **Status:** Optional
- **Default:** `false`
- **Type:** Boolean
- **Description:** Auto-create missing indexes

### INDEX_OPT_AUTO_DROP_STALE
- **Status:** Optional
- **Default:** `false`
- **Type:** Boolean
- **Description:** Auto-drop unused indexes

### INDEX_OPT_SEQ_SCAN_THRESHOLD
- **Status:** Optional
- **Default:** `1000`
- **Type:** Integer
- **Description:** Threshold for sequential scans to trigger optimization

### INDEX_OPT_SLOW_QUERY_MS
- **Status:** Optional
- **Default:** `200` (milliseconds)
- **Type:** Integer
- **Description:** Slow query threshold

### INDEX_OPT_SCHEMA
- **Status:** Optional
- **Default:** `public`
- **Type:** String
- **Description:** Database schema for optimization

---

## Sharding Configuration

### SHARD_COUNT
- **Status:** Optional
- **Default:** `0` (disabled)
- **Valid Range:** 0+ (0 = single shard mode)
- **Type:** Integer
- **Description:** Number of database shards
- **Examples:**
  - `SHARD_COUNT=0` (single database)
  - `SHARD_COUNT=4` (4 shards)
  - `SHARD_COUNT=16` (large deployments)

### SHARD_REBALANCE_HIGH_WATERMARK
- **Status:** Optional
- **Default:** `80` (%)
- **Valid Range:** 1-100
- **Type:** Integer
- **Description:** Trigger rebalancing when utilization exceeds this %

### SHARD_REBALANCE_LOW_WATERMARK
- **Status:** Optional
- **Default:** `20` (%)
- **Valid Range:** 0-99
- **Type:** Integer
- **Description:** Target utilization after rebalancing

### SHARD_REBALANCE_BATCH_SIZE
- **Status:** Optional
- **Default:** `500`
- **Valid Range:** 1-10000
- **Type:** Integer
- **Description:** Records per batch during shard rebalancing

---

## Circuit Breaker Configuration

### CIRCUIT_BREAKER_TIMEOUT_MS
- **Status:** Optional
- **Default:** `3000` (3 seconds)
- **Valid Range:** 100+
- **Type:** Integer (milliseconds)
- **Description:** Timeout for circuit breaker calls

### CIRCUIT_BREAKER_ERROR_THRESHOLD
- **Status:** Optional
- **Default:** `50` (%)
- **Valid Range:** 1-100
- **Type:** Integer
- **Description:** Error % to open circuit

### CIRCUIT_BREAKER_RESET_TIMEOUT_MS
- **Status:** Optional
- **Default:** `30000` (30 seconds)
- **Type:** Integer (milliseconds)
- **Description:** Time before attempting to reset opened circuit

### CIRCUIT_BREAKER_ROLLING_COUNT_TIMEOUT
- **Status:** Optional
- **Default:** `60000` (60 seconds)
- **Type:** Integer (milliseconds)
- **Description:** Rolling window size for error tracking

### CIRCUIT_BREAKER_ROLLING_COUNT_BUCKETS
- **Status:** Optional
- **Default:** `10`
- **Type:** Integer
- **Description:** Number of buckets in rolling window

---

## CORS Configuration

### CORS_ALLOWED_ORIGINS
- **Status:** Optional
- **Default:** `http://localhost:3000,http://localhost:4000`
- **Type:** Comma-separated URLs
- **Description:** Allowed origins for CORS requests
- **Examples:**
  - Local: `CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4000`
  - Production: `CORS_ALLOWED_ORIGINS=https://app.teachlink.io,https://admin.teachlink.io`
  - Multiple regions: `CORS_ALLOWED_ORIGINS=https://us.teachlink.io,https://eu.teachlink.io`

---

## Deployment Examples

### Local Development Environment

```bash
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=teachlink

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Auth
JWT_SECRET=dev-secret-key-change-me
JWT_REFRESH_SECRET=dev-refresh-secret-change-me
ENCRYPTION_SECRET=0123456789abcdef0123456789abcdef

# Email (use Mailhog)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=test
SMTP_PASS=test
EMAIL_FROM=noreply@localhost

# AWS (use LocalStack)
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
AWS_S3_BUCKET=teachlink-local

# Session
SESSION_SECRET=dev-session-secret-change-me

# Features
ENABLE_AUTH=true
ENABLE_PAYMENTS=false
ENABLE_AB_TESTING=false
```

### Staging Environment

```bash
NODE_ENV=staging
PORT=3000
APP_URL=https://staging.teachlink.io

# Database
DATABASE_HOST=staging-db.internal
DATABASE_PORT=5432
DATABASE_USER=teachlink_staging
DATABASE_PASSWORD=<use-aws-secrets-manager>
DATABASE_NAME=teachlink_staging
DATABASE_POOL_MAX=20
DATABASE_POOL_MIN=5

# Redis
REDIS_HOST=staging-redis.internal
REDIS_PORT=6379

# Auth
JWT_SECRET=<use-aws-secrets-manager>
JWT_REFRESH_SECRET=<use-aws-secrets-manager>
ENCRYPTION_SECRET=<use-aws-secrets-manager>
BCRYPT_ROUNDS=10

# Email (SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=true
SENDGRID_API_KEY=<use-aws-secrets-manager>
EMAIL_FROM=noreply-staging@teachlink.io

# AWS
AWS_ACCESS_KEY_ID=<use-iam-role>
AWS_SECRET_ACCESS_KEY=<use-iam-role>
AWS_REGION=us-east-1
AWS_S3_BUCKET=teachlink-staging

# Session
SESSION_SECRET=<use-aws-secrets-manager>

# Monitoring
ELASTICSEARCH_NODE=http://staging-elasticsearch.internal:9200
METRICS_ENABLED=true
METRICS_AUTH_TOKEN=<staging-token>

# Features
ENABLE_AUTH=true
ENABLE_PAYMENTS=true
ENABLE_AB_TESTING=false
```

### Production Environment

```bash
NODE_ENV=production
PORT=3000
APP_URL=https://api.teachlink.io
SHUTDOWN_TIMEOUT_MS=30000

# Database (with replicas)
DATABASE_HOST=prod-db.internal
DATABASE_PORT=5432
DATABASE_USER=teachlink_prod
DATABASE_PASSWORD=<aws-secrets-manager>
DATABASE_NAME=teachlink
DATABASE_POOL_MAX=50
DATABASE_POOL_MIN=10
DATABASE_REPLICA_HOSTS=replica-1.internal,replica-2.internal,replica-3.internal
DATABASE_REPLICA_USER=teachlink_ro
DATABASE_REPLICA_PASSWORD=<aws-secrets-manager>

# Redis (cluster)
REDIS_HOST=redis-cluster.internal
REDIS_PORT=6379

# Auth
JWT_SECRET=<aws-secrets-manager>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<aws-secrets-manager>
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_SECRET=<aws-secrets-manager>
BCRYPT_ROUNDS=12

# Email (SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=true
SENDGRID_API_KEY=<aws-secrets-manager>
EMAIL_FROM=noreply@teachlink.io

# AWS (IAM role)
AWS_REGION=us-east-1
AWS_S3_BUCKET=teachlink-prod
AWS_KMS_KEY_ID=<prod-kms-key>
AWS_CLOUDFRONT_DISTRIBUTION_ID=<prod-cf-id>

# Session
SESSION_SECRET=<aws-secrets-manager>
SESSION_TTL_SECONDS=3600

# Monitoring
ELASTICSEARCH_NODE=https://prod-elasticsearch.internal:9200
ELASTICSEARCH_API_KEY=<aws-secrets-manager>
KIBANA_URL=https://prod-kibana.internal
METRICS_ENABLED=true
METRICS_AUTH_TOKEN=<prod-token>
ALERT_EMAIL_RECIPIENTS=ops@teachlink.io,oncall@teachlink.io
ALERT_SLACK_WEBHOOK_URL=<aws-secrets-manager>

# Sharding
SHARD_COUNT=4

# Features
ENABLE_AUTH=true
ENABLE_PAYMENTS=true
ENABLE_AB_TESTING=true
```

---

## Validation and Health Checks

### Environment Validation on Startup

The application validates environment variables on startup using the schema defined in `src/config/env.validation.ts`.

Run validation manually:

```bash
# Check if current environment is valid
npm run typecheck

# Validate with explicit environment
NODE_ENV=production npm run build
```

### Service Health Check

Each external service has a health check endpoint:

- AWS: `<AWS_HEALTH_URL>`
- Stripe: `<STRIPE_HEALTH_URL>`
- SendGrid: `<SENDGRID_HEALTH_URL>`

View: `/health` (main health endpoint)

---

## Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as a template
2. **Use AWS Secrets Manager** in production for sensitive values
3. **Rotate secrets regularly** - Use `SECRETS_TO_ROTATE` and `JWT_SECRETS`
4. **Use different passwords** for each environment
5. **Enable HTTPS** in production (`APP_URL=https://...`)
6. **Set strong JWT_SECRET** - Minimum 32 characters
7. **Use SSL for databases** in production
8. **Enable rate limiting** with `ENABLE_RATE_LIMITING=true`
9. **Monitor access logs** in production
10. **Use environment-specific configs** - Never use dev values in production

---

## Troubleshooting

### Application fails to start

**Check:**
1. All required variables are set
2. No typos in environment variable names
3. Valid values for enum variables (NODE_ENV, SECRET_PROVIDER, etc.)
4. Numeric variables are actual numbers, not strings

Run validation:
```bash
node ./scripts/validate-env.js
```

### Database connection fails

**Check:**
- `DATABASE_HOST` is reachable
- `DATABASE_PORT` is correct (default 5432)
- `DATABASE_USER` and `DATABASE_PASSWORD` are correct
- `DATABASE_NAME` database exists
- Network security groups allow connection

### Redis connection fails

**Check:**
- `REDIS_HOST` is reachable
- `REDIS_PORT` is correct (default 6379)
- Redis is running and accepts connections

### Email sending fails

**Check:**
- `SMTP_HOST` and `SMTP_PORT` are correct
- `SMTP_USER` and `SMTP_PASS` are valid credentials
- `EMAIL_FROM` is authorized by SMTP server
- Firewall allows outbound SMTP connections (usually port 587 or 465)

### AWS/S3 access denied

**Check:**
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` have S3 permissions
- `AWS_REGION` matches S3 bucket region
- `AWS_S3_BUCKET` bucket name is correct and exists
- In production, use IAM role instead of access keys

---

## See Also

- [.env.example](.env.example) - Template with commented values
- [.env.staging](.env.staging) - Staging environment config
- [src/config/env.validation.ts](src/config/env.validation.ts) - Validation schema
- [Deployment Runbook](deployment/deployment-runbook.md)
- [API Documentation](docs/API_DOCUMENTATION_BEST_PRACTICES.md)
