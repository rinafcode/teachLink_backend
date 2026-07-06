# Environment Setup Guide

Step-by-step guide for configuring environment variables for TeachLink Backend deployment.

---

## Quick Start

### For Local Development

```bash
# Copy template file
cp .env.example .env

# Validate configuration
npm run validate:env

# Update .env with local values
# Edit: DATABASE_HOST, DATABASE_PORT, REDIS_HOST, etc.

# Start development server
npm run start:dev
```

### For Production Deployment

```bash
# Set environment variables from AWS Secrets Manager or Vault
export NODE_ENV=production
export DATABASE_HOST=prod-db.internal
export DATABASE_USER=teachlink_prod
# ... set all required variables

# Validate configuration
npm run validate:env

# Build and start
npm run build
npm run start:prod
```

---

## Step-by-Step Configuration

### 1. Copy Template File

```bash
cp .env.example .env
```

This creates a `.env` file from the template. **Never commit this file.**

### 2. Identify Your Deployment Type

Choose from:

- **Local Development** - Single machine, all services on localhost
- **Docker Compose** - Multi-container setup with docker-compose
- **Kubernetes** - Production-grade deployment with K8s
- **AWS ECS/EC2** - Amazon cloud deployment
- **Heroku/Railway** - Platform-as-a-service (PaaS)

### 3. Configure Core Variables

#### Minimum Required Variables

These must be set for the application to start:

```env
# Database (REQUIRED)
DATABASE_HOST=
DATABASE_PORT=
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_NAME=

# Redis (REQUIRED)
REDIS_HOST=
REDIS_PORT=

# Secrets (REQUIRED, min 32 chars in production)
JWT_SECRET=
JWT_REFRESH_SECRET=
ENCRYPTION_SECRET=
SESSION_SECRET=

# Email (REQUIRED)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=

# AWS (REQUIRED)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

# Payments (REQUIRED)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email Service (REQUIRED)
SENDGRID_API_KEY=
```

### 4. Validate Configuration

```bash
npm run validate:env
```

This script checks:
- ✅ All required variables are set
- ✅ Values have correct data types
- ✅ Values are within valid ranges
- ✅ Email addresses are valid
- ✅ URLs have correct format
- ⚠️ Production-specific warnings

### 5. Set Environment-Specific Values

Choose configuration from examples below.

### 6. Start Application

```bash
# Development
npm run start:dev

# Production
npm run start:prod

# Cluster mode
CLUSTER_MODE=true npm run start:prod
```

---

## Configuration Examples

### Example 1: Local Development

**File: `.env.local`**

```bash
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database (local PostgreSQL)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=teachlink

# Redis (local)
REDIS_HOST=localhost
REDIS_PORT=6379

# Auth (temporary/weak for development)
JWT_SECRET=dev-secret-key-at-least-10-chars-but-32-recommended
JWT_REFRESH_SECRET=dev-refresh-secret-at-least-10-chars-but-32-recommended
ENCRYPTION_SECRET=0123456789abcdef0123456789abcdef

# Session
SESSION_SECRET=dev-session-secret-min-10-chars

# Email (use Mailhog for local testing)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=test
SMTP_PASS=test
EMAIL_FROM=test@localhost
EMAIL_FROM_NAME=TeachLink Dev

# SendGrid (mock)
SENDGRID_API_KEY=test-key

# AWS (use LocalStack)
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_S3_BUCKET=teachlink-local

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Feature flags
ENABLE_PAYMENTS=true
ENABLE_AB_TESTING=false
CLUSTER_MODE=false
```

**Setup with Docker Compose:**

```bash
# Start services
docker-compose -f docker-compose.yml up -d

# Wait for services to be ready
sleep 10

# Copy .env
cp .env.example .env

# Edit .env with local values (shown above)

# Validate
npm run validate:env

# Start application
npm run start:dev
```

### Example 2: Staging Environment

**File: `.env.staging`**

```bash
NODE_ENV=staging
PORT=3000
APP_URL=https://staging.teachlink.io

# Database (AWS RDS)
DATABASE_HOST=staging-db-instance.c9akciq32.us-east-1.rds.amazonaws.com
DATABASE_PORT=5432
DATABASE_USER=teachlink_staging
DATABASE_PASSWORD=<use-aws-secrets-manager>
DATABASE_NAME=teachlink_staging
DATABASE_POOL_MAX=20
DATABASE_POOL_MIN=5
DATABASE_REPLICA_HOSTS=staging-replica.c9akciq32.us-east-1.rds.amazonaws.com
DATABASE_REPLICA_PORT=5432

# Redis (AWS ElastiCache)
REDIS_HOST=staging-redis.a1b2c3d.ng.0001.use1.cache.amazonaws.com
REDIS_PORT=6379

# Auth (from AWS Secrets Manager)
JWT_SECRET=<aws-secrets-manager-value>
JWT_REFRESH_SECRET=<aws-secrets-manager-value>
ENCRYPTION_SECRET=<aws-secrets-manager-value>
BCRYPT_ROUNDS=10

# Session
SESSION_SECRET=<aws-secrets-manager-value>

# Email (SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=true
SENDGRID_API_KEY=<aws-secrets-manager-value>
EMAIL_FROM=noreply-staging@teachlink.io

# AWS
AWS_REGION=us-east-1
AWS_S3_BUCKET=teachlink-staging
AWS_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789:key/12345678-1234-1234-1234-123456789012

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_<staging-key>
STRIPE_WEBHOOK_SECRET=whsec_<staging-secret>

# Monitoring
ELASTICSEARCH_NODE=https://staging-elasticsearch.internal:9200
ELASTICSEARCH_API_KEY=<aws-secrets-manager-value>
KIBANA_URL=https://staging-kibana.internal
METRICS_ENABLED=true
ALERT_EMAIL_RECIPIENTS=staging-ops@teachlink.io

# Features
ENABLE_PAYMENTS=true
ENABLE_AB_TESTING=false
CLUSTER_MODE=false
```

**Setup steps:**

```bash
# 1. Create .env from template
cp .env.example .env.staging

# 2. Edit with staging values
nano .env.staging

# 3. Use in deployment
NODE_ENV=staging source .env.staging npm run build
NODE_ENV=staging source .env.staging npm run start:prod
```

### Example 3: Production Environment

**File: `.env.production`**

```bash
NODE_ENV=production
PORT=3000
APP_URL=https://api.teachlink.io
SHUTDOWN_TIMEOUT_MS=30000

# Database (AWS RDS Multi-AZ)
DATABASE_HOST=prod-db-instance.c9akciq32.us-east-1.rds.amazonaws.com
DATABASE_PORT=5432
DATABASE_USER=teachlink_prod
DATABASE_PASSWORD=<use-aws-secrets-manager>
DATABASE_NAME=teachlink
DATABASE_POOL_MAX=50
DATABASE_POOL_MIN=10
DATABASE_REPLICA_HOSTS=prod-replica-1.internal,prod-replica-2.internal,prod-replica-3.internal
DATABASE_REPLICA_PORT=5432

# Redis (AWS ElastiCache Cluster)
REDIS_HOST=prod-redis-cluster.a1b2c3d.ng.0001.use1.cache.amazonaws.com
REDIS_PORT=6379

# Auth (from AWS Secrets Manager)
JWT_SECRET=<aws-secrets-manager-value>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<aws-secrets-manager-value>
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_SECRET=<aws-secrets-manager-value>
BCRYPT_ROUNDS=12

# Session (production values)
SESSION_SECRET=<aws-secrets-manager-value>
SESSION_TTL_SECONDS=3600
STICKY_SESSIONS_REQUIRED=true
TRUST_PROXY=true

# Email (SendGrid production)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=true
SENDGRID_API_KEY=<aws-secrets-manager-value>
EMAIL_FROM=noreply@teachlink.io
EMAIL_FROM_NAME=TeachLink

# AWS (production)
AWS_REGION=us-east-1
AWS_S3_BUCKET=teachlink-prod
AWS_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789:key/12345678-1234-1234-1234-123456789012
AWS_CLOUDFRONT_DISTRIBUTION_ID=E123ABCDEF

# Stripe (live mode)
STRIPE_SECRET_KEY=sk_live_<prod-key>
STRIPE_WEBHOOK_SECRET=whsec_<prod-secret>

# Monitoring & Logging
ELASTICSEARCH_NODE=https://prod-elasticsearch.internal:9200
ELASTICSEARCH_API_KEY=<aws-secrets-manager-value>
KIBANA_URL=https://prod-kibana.internal
METRICS_ENABLED=true
METRICS_AUTH_TOKEN=<strong-random-token>
ALERT_EMAIL_RECIPIENTS=ops@teachlink.io,oncall@teachlink.io
ALERT_SLACK_WEBHOOK_URL=<aws-secrets-manager-value>

# Cluster & Performance
CLUSTER_MODE=true
CLUSTER_WORKERS=8
DATABASE_POOL_MAX=50
DATABASE_POOL_MIN=10

# Sharding (if enabled)
SHARD_COUNT=4

# Secrets Management
SECRET_PROVIDER=aws
SECRET_CACHE_TTL_MS=300000

# Feature Flags (production)
ENABLE_PAYMENTS=true
ENABLE_AB_TESTING=true
ENABLE_SEARCH=true
ENABLE_OBSERVABILITY=true
```

**Kubernetes Deployment:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: teachlink-config
data:
  NODE_ENV: "production"
  PORT: "3000"
  APP_URL: "https://api.teachlink.io"
---
apiVersion: v1
kind: Secret
metadata:
  name: teachlink-secrets
type: Opaque
stringData:
  DATABASE_HOST: prod-db.internal
  DATABASE_USER: teachlink_prod
  DATABASE_PASSWORD: <base64-encoded>
  DATABASE_NAME: teachlink
  JWT_SECRET: <base64-encoded>
  # ... other secrets
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: teachlink-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: teachlink-backend
  template:
    metadata:
      labels:
        app: teachlink-backend
    spec:
      containers:
      - name: backend
        image: teachlink-backend:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: teachlink-config
        - secretRef:
            name: teachlink-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
```

---

## Working with Secrets

### Local Development

Use `.env` file (never commit):

```env
JWT_SECRET=my-dev-secret
DATABASE_PASSWORD=my-dev-password
```

### Production

Use **AWS Secrets Manager**:

```bash
# Store secret
aws secretsmanager create-secret \
  --name teachlink/prod/jwt_secret \
  --secret-string "very-long-random-string-min-32-chars"

# Reference in environment
export JWT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id teachlink/prod/jwt_secret \
  --query SecretString --output text)
```

Or use **HashiCorp Vault**:

```bash
# Store secret
vault kv put secret/teachlink/prod jwt_secret=value

# Configure app
SECRET_PROVIDER=vault
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=<token>
VAULT_SECRET_PATH=secret/data/teachlink/prod
```

---

## Validation Troubleshooting

### Issue: Missing Required Variables

**Error:**
```
❌ Validation Failed
   22 required variables have errors
```

**Solution:**
```bash
# Check which variables are missing
npm run validate:env

# See documentation
cat ENV_VARS_DOCUMENTATION.md

# Set missing variables
export DATABASE_HOST=localhost
export DATABASE_PORT=5432
# ... etc

# Re-validate
npm run validate:env
```

### Issue: Invalid Email Format

**Error:**
```
EMAIL_FROM
  → Invalid email format
```

**Solution:**
```env
# Wrong
EMAIL_FROM=noreply

# Correct
EMAIL_FROM=noreply@teachlink.io
```

### Issue: Port Out of Range

**Error:**
```
DATABASE_PORT
  → Must be >= 1 and <= 65535
```

**Solution:**
```env
# Wrong
DATABASE_PORT=99999

# Correct
DATABASE_PORT=5432
```

### Issue: Encryption Secret Wrong Length

**Error:**
```
ENCRYPTION_SECRET
  → Must be exactly 32 characters
```

**Solution:**
```bash
# Generate 32-character secret
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Output: 0123456789abcdef0123456789abcdef (32 chars)
export ENCRYPTION_SECRET=0123456789abcdef0123456789abcdef
```

---

## Deployment Checklist

### Before Deployment

- [ ] Copy `.env.example` to `.env`
- [ ] Set all required variables
- [ ] Run `npm run validate:env` - all checks pass
- [ ] Review `ENV_VARS_DOCUMENTATION.md` for your environment
- [ ] Use AWS Secrets Manager for sensitive values (production)
- [ ] Test database connection
- [ ] Test Redis connection
- [ ] Test email service (SMTP)
- [ ] Test Stripe webhook receiver

### Production Checklist

- [ ] `NODE_ENV=production`
- [ ] `CLUSTER_MODE=true` (or appropriate for your setup)
- [ ] All secrets >= 32 characters
- [ ] Database replicas configured (if applicable)
- [ ] Monitoring enabled (Elasticsearch, metrics)
- [ ] Alerts configured (email, Slack, PagerDuty)
- [ ] CORS_ALLOWED_ORIGINS set to production domains only
- [ ] TRUST_PROXY=true (if behind load balancer)
- [ ] No localhost/development values in production
- [ ] SSL/TLS certificates configured for APP_URL
- [ ] Regular secret rotation scheduled

### Post-Deployment

- [ ] Application starts without errors
- [ ] `/health` endpoint returns 200
- [ ] `/metrics` endpoint available (with authentication)
- [ ] Database migrations have run
- [ ] Email sending works (test with alert)
- [ ] Elasticsearch indices created
- [ ] Monitoring dashboards show data

---

## Environment Variables by Use Case

### For Microservices

```env
# Service identification
SERVICE_NAME=teachlink-backend-api
CLUSTER_MODE=true

# Shared Redis
REDIS_HOST=shared-redis.internal
REDIS_URL=redis://user:pass@shared-redis.internal:6379/0

# Separate queues
QUEUE_REDIS_URL=redis://user:pass@shared-redis.internal:6379/1

# Observability
METRICS_ENABLED=true
ELASTICSEARCH_NODE=https://elasticsearch.internal:9200
```

### For High-Traffic Setup

```env
# Cluster
CLUSTER_MODE=true
CLUSTER_WORKERS=16

# Database
DATABASE_POOL_MAX=100
DATABASE_POOL_MIN=20
DATABASE_REPLICA_HOSTS=replica1,replica2,replica3

# Caching
ENABLE_CACHING=true
REDIS_HOST=redis-cluster.internal

# Rate limiting
ENABLE_RATE_LIMITING=true
THROTTLE_LIMIT=1000

# CDN
CDN_ENABLED=true
CDN_DOMAIN=cdn.teachlink.io
```

### For Multi-Tenant Setup

```env
ENABLE_TENANCY=true
DATABASE_POOL_MAX=30
SESSION_TTL_SECONDS=86400
TRUST_PROXY=true
```

---

## Common Pitfalls

### 1. Committing .env File

```bash
# ❌ WRONG: Don't do this
git add .env
git commit -m "Add .env"

# ✅ RIGHT: Use .env.example
git add .env.example
echo ".env" >> .gitignore
```

### 2. Using Weak Secrets

```bash
# ❌ WRONG: Too short, predictable
JWT_SECRET=secret123

# ✅ RIGHT: Long, random, strong
JWT_SECRET=$(openssl rand -base64 32)
```

### 3. Mixing Development and Production Values

```bash
# ❌ WRONG: Development database in production
NODE_ENV=production
DATABASE_HOST=localhost

# ✅ RIGHT: Environment-specific values
NODE_ENV=production
DATABASE_HOST=prod-db.internal
```

### 4. Not Validating Before Deployment

```bash
# ❌ WRONG: Skip validation
npm run build && npm run start:prod

# ✅ RIGHT: Validate first
npm run validate:env && npm run build && npm run start:prod
```

### 5. Hardcoding Secrets in Docker Image

```dockerfile
# ❌ WRONG: Secrets in Dockerfile
FROM node:18
ENV JWT_SECRET=my-secret
RUN npm run build

# ✅ RIGHT: Provide at runtime
FROM node:18
RUN npm run build
# Pass JWT_SECRET at run time
```

---

## Reference Documentation

- **Full Reference:** [ENV_VARS_DOCUMENTATION.md](./ENV_VARS_DOCUMENTATION.md)
- **Validation Script:** `npm run validate:env`
- **Example Config:** [.env.example](./.env.example)
- **Staging Config:** [.env.staging](./.env.staging)

---

## Support

For help with environment setup:

1. **Check Documentation**
   ```bash
   cat ENV_VARS_DOCUMENTATION.md
   ```

2. **Run Validation**
   ```bash
   npm run validate:env
   ```

3. **Review Examples**
   - See "Configuration Examples" section above
   - Check `.env.example` for all available variables

4. **Check Logs**
   ```bash
   npm run start:dev 2>&1 | grep -i "error\|failed\|invalid"
   ```

5. **Contact DevOps**
   - For AWS Secrets Manager help
   - For Kubernetes deployment
   - For production access
