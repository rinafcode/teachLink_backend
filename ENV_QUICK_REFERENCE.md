# Environment Variables - Quick Reference

**Fast access guide to environment variable configuration.**

---

## 🚀 Quick Start

### Local Development
```bash
cp .env.example .env
# Edit .env with localhost values
npm run validate:env
npm run start:dev
```

### Validate Any Time
```bash
npm run validate:env
```

### Full Documentation
```bash
cat ENV_VARS_DOCUMENTATION.md       # Complete reference
cat ENV_SETUP_GUIDE.md              # Step-by-step guide
cat ENV_IMPLEMENTATION_SUMMARY.md   # What was built
```

---

## 📋 Essential Variables (Must Set)

```env
# Database (REQUIRED)
DATABASE_HOST=your-db-host
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your-password
DATABASE_NAME=teachlink

# Redis (REQUIRED)
REDIS_HOST=your-redis-host
REDIS_PORT=6379

# Secrets (REQUIRED - min 32 chars)
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
ENCRYPTION_SECRET=0123456789abcdef0123456789abcdef  # Exactly 32 chars
SESSION_SECRET=your-session-secret-min-32-chars

# Email (REQUIRED)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
EMAIL_FROM=noreply@example.com

# AWS (REQUIRED)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=your-bucket

# Stripe (REQUIRED)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# SendGrid (REQUIRED)
SENDGRID_API_KEY=your-api-key
```

---

## 🔧 Common Configurations

### Defaults (Most Optional Variables)
```env
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
AWS_REGION=us-east-1
BCRYPT_ROUNDS=10
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
DATABASE_POOL_MAX=30
DATABASE_POOL_MIN=5
```

### Production Adjustments
```env
NODE_ENV=production
BCRYPT_ROUNDS=12
CLUSTER_MODE=true
DATABASE_POOL_MAX=50
DATABASE_POOL_MIN=10
METRICS_ENABLED=true
```

### High Traffic
```env
CLUSTER_MODE=true
DATABASE_POOL_MAX=100
ENABLE_CACHING=true
ENABLE_RATE_LIMITING=true
```

---

## ✅ Validation Rules

| Variable | Type | Min | Max | Notes |
|----------|------|-----|-----|-------|
| PORT | Integer | 1 | 65535 | Application port |
| DATABASE_PORT | Integer | 1 | 65535 | DB port |
| REDIS_PORT | Integer | 1 | 65535 | Redis port |
| SMTP_PORT | Integer | 1 | 65535 | SMTP port |
| JWT_SECRET | String | 10 | - | 32+ for production |
| ENCRYPTION_SECRET | String | 32 | 32 | Exactly 32 chars |
| BCRYPT_ROUNDS | Integer | 4 | 15 | Hash rounds |
| EMAIL_FROM | Email | - | - | Valid email format |
| APP_URL | URL | - | - | Valid URL |
| NODE_ENV | Enum | - | - | dev/prod/staging/test |

---

## 🐛 Common Issues & Fixes

| Issue | Error | Fix |
|-------|-------|-----|
| Missing required var | `✗ DATABASE_HOST` | Set the variable in .env |
| Invalid email | `Invalid email format` | Use proper email: user@domain.com |
| Invalid port | `Must be >= 1 and <= 65535` | Use port in valid range |
| Short secret | `Must be at least 32 chars` | Generate longer secret |
| Not a number | `Invalid integer format` | Remove quotes, use number |

---

## 🔐 Security Checklist

- [ ] Never commit .env files (add to .gitignore)
- [ ] Use strong secrets (min 32 chars)
- [ ] Rotate secrets regularly
- [ ] Use different values per environment
- [ ] Store production secrets in AWS Secrets Manager
- [ ] Enable HTTPS (APP_URL=https://...)
- [ ] Set NODE_ENV=production in production
- [ ] Run validation before deployment

---

## 📂 Files Reference

| File | Purpose | Size |
|------|---------|------|
| ENV_VARS_DOCUMENTATION.md | Complete reference | 40KB |
| ENV_SETUP_GUIDE.md | Step-by-step guide | 15KB |
| ENV_IMPLEMENTATION_SUMMARY.md | What was built | 13KB |
| .env.example | Configuration template | 25KB |
| scripts/validate-env.js | Validation script | 13KB |

---

## 🎯 By Role

### Developer
1. Copy .env.example to .env
2. Set localhost values
3. Run `npm run validate:env`
4. Start with `npm run start:dev`

### DevOps Engineer
1. Review ENV_VARS_DOCUMENTATION.md
2. Configure for your environment
3. Run validation in CI/CD
4. Set up secrets management

### SRE
1. Study deployment examples
2. Implement in Kubernetes
3. Configure monitoring variables
4. Set up alerts

---

## 💡 Tips

- **Generate Random Secret:** `openssl rand -base64 32`
- **Validate Production Setup:** `NODE_ENV=production npm run validate:env`
- **See All Variables:** `npm run validate:env` (shows all)
- **Quiet Mode:** Not implemented yet, but `npm run validate:env 2>/dev/null` hides warnings
- **Custom Validation:** Edit `scripts/validate-env.js` for additional rules

---

## 🔗 Links

- **Full Documentation:** ENV_VARS_DOCUMENTATION.md
- **Setup Instructions:** ENV_SETUP_GUIDE.md
- **Implementation Details:** ENV_IMPLEMENTATION_SUMMARY.md
- **Template File:** .env.example
- **Validation Script:** scripts/validate-env.js

---

## 📞 Quick Help

**Run validation:**
```bash
npm run validate:env
```

**See all variables:**
```bash
grep "^[A-Z_]" .env.example | wc -l
```

**Check documentation:**
```bash
grep "^### " ENV_VARS_DOCUMENTATION.md
```

**Generate 32-char secret:**
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

## ✨ Summary

✅ **108+ environment variables** fully documented
✅ **Auto-validation** with detailed error messages  
✅ **Deployment examples** for local/staging/production
✅ **Security best practices** included
✅ **Troubleshooting guide** for common issues

**Total:** ~100KB of comprehensive documentation
**Status:** Ready to use

---

**Last Updated:** June 24, 2026
