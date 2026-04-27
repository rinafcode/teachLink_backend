# Secrets Management & Idempotent Operations Implementation

## Overview

This document describes the implementation of two critical security and reliability features:
1. **Secrets Management** (Issue #355)
2. **Idempotent Operations** (Issue #384)

---

## 1. Secrets Management (Issue #355)

### Features Implemented

✅ **AWS Secrets Manager Integration**
- Secure retrieval and storage of secrets
- Automatic caching with configurable TTL
- Secret rotation support
- Weekly automated rotation for critical secrets

✅ **HashiCorp Vault Integration**
- Alternative secret provider option
- KV secrets engine support
- Token-based authentication
- Secure HTTPS communication

✅ **Secret Rotation**
- Manual rotation via API endpoints
- Automated weekly rotation scheduler
- Cryptographically secure secret generation
- Cache invalidation on rotation

### Architecture

```
src/security/secrets/
├── secrets-manager.service.ts      # AWS Secrets Manager provider
├── vault-secrets.service.ts        # HashiCorp Vault provider
├── secrets.controller.ts           # REST API endpoints
└── secrets.module.ts               # Module definition
```

### Configuration

Add to `.env`:

```env
# Secret provider: 'env', 'aws', or 'vault'
SECRET_PROVIDER=env

# AWS Secrets Manager (when SECRET_PROVIDER=aws)
SECRET_CACHE_TTL_MS=300000
SECRETS_TO_ROTATE=JWT_SECRET,DATABASE_PASSWORD,STRIPE_SECRET_KEY

# HashiCorp Vault (when SECRET_PROVIDER=vault)
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=your-vault-token
VAULT_SECRET_PATH=secret/data
```

### API Endpoints

All endpoints require **ADMIN** role and JWT authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/secrets/aws/:secretName` | Get secret from AWS (value redacted) |
| GET | `/secrets/vault/:secretName` | Get secret from Vault (value redacted) |
| POST | `/secrets/aws/rotate/:secretName` | Rotate AWS secret |
| POST | `/secrets/vault/rotate/:secretName` | Rotate Vault secret |
| POST | `/secrets/cache/clear` | Clear secret cache |

### Usage Example

```typescript
import { SecretsManagerService } from './security/secrets/secrets-manager.service';

@Injectable()
export class MyService {
  constructor(
    private readonly secretsManager: SecretsManagerService,
  ) {}

  async getDatabasePassword(): Promise<string> {
    return await this.secretsManager.getSecret('database/password');
  }
}
```

### Security Features

- 🔒 Secrets never exposed in logs (redacted in API responses)
- 🔒 Time-based cache with automatic expiration
- 🔒 Cryptographically secure random generation for rotations
- 🔒 Role-based access control (ADMIN only)
- 🔒 Scheduled rotation for compliance requirements

---

## 2. Idempotent Operations (Issue #384)

### Features Implemented

✅ **Idempotency Interceptor**
- Automatic deduplication of POST/PUT/PATCH requests
- Redis-based storage for idempotency records
- Distributed locking to prevent race conditions
- Configurable TTL per endpoint

✅ **Idempotency Decorator**
- Easy-to-use `@Idempotent()` decorator
- Per-endpoint TTL configuration
- Automatic header validation

✅ **Deduplication Logic**
- SHA-256 hash-based key generation
- User + endpoint + payload fingerprinting
- Conflict detection for concurrent requests
- Response caching for duplicate requests

### Architecture

```
src/common/
├── decorators/
│   └── idempotency.decorator.ts    # @Idempotent() decorator
├── interceptors/
│   └── idempotency.interceptor.ts  # Request interception logic
├── services/
│   └── idempotency.service.ts      # Redis storage & key generation
└── modules/
    └── idempotency.module.ts       # Module definition
```

### Configuration

Add to `.env`:

```env
# Idempotency key TTL in seconds (default: 24 hours)
IDEMPOTENCY_TTL_SECONDS=86400
```

### Usage Example

```typescript
import { Idempotent } from '../common/decorators/idempotency.decorator';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

@Post('create-intent')
@Idempotent({ ttl: 86400 }) // 24 hours
@UseInterceptors(IdempotencyInterceptor)
@ApiHeader({ 
  name: 'X-Idempotency-Key', 
  description: 'Unique key for idempotent requests', 
  required: true 
})
async createPaymentIntent(
  @Body() createPaymentDto: CreatePaymentDto,
): Promise<PaymentResult> {
  return this.paymentsService.createPaymentIntent(createPaymentDto);
}
```

### Client Usage

Clients must include the `X-Idempotency-Key` header:

```bash
curl -X POST http://localhost:3000/payments/create-intent \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-request-id-12345" \
  -d '{"amount": 100, "courseId": "course_abc"}'
```

**Behavior:**
- First request: Processes normally and stores response
- Duplicate request (same key): Returns cached response without re-processing
- Concurrent request: Returns 409 Conflict if still processing

### Applied To

The following critical endpoints now have idempotency protection:

| Endpoint | Method | TTL |
|----------|--------|-----|
| `/payments/create-intent` | POST | 24 hours |
| `/payments/subscriptions` | POST | 24 hours |
| `/payments/refund` | POST | 24 hours |

### How It Works

1. **Request arrives** with `X-Idempotency-Key` header
2. **Check cache**: If key exists, return cached response immediately
3. **Acquire lock**: Prevent concurrent processing of same key
4. **Process request**: Execute the actual business logic
5. **Store response**: Cache the response with the idempotency key
6. **Release lock**: Allow future requests with different keys

### Error Handling

- **Missing header**: Returns `400 Bad Request`
- **Concurrent request**: Returns `409 Conflict` with "Request is being processed"
- **Storage failure**: Gracefully degrades (errors logged, request continues)

---

## Testing

### Run Tests

```bash
# Secrets management tests
npm test -- secrets-manager.service.spec.ts

# Idempotency tests
npm test -- idempotency.service.spec.ts

# All tests
npm test
```

### Test Coverage

Both implementations include unit tests covering:
- Service initialization
- Core functionality (get/set/rotate secrets, generate keys)
- Cache behavior
- Error scenarios

---

## Migration Guide

### For Existing Endpoints

To add idempotency to any POST/PUT/PATCH endpoint:

1. Import the decorator and interceptor:
```typescript
import { Idempotent } from '../common/decorators/idempotency.decorator';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
```

2. Add decorators to the endpoint:
```typescript
@Post('your-endpoint')
@Idempotent({ ttl: 86400 })
@UseInterceptors(IdempotencyInterceptor)
@ApiHeader({ name: 'X-Idempotency-Key', required: true })
async yourMethod(@Body() dto: YourDto) {
  // Your logic here
}
```

3. Update API documentation to inform clients about the required header.

### For Secret Migration

To migrate from environment variables to AWS Secrets Manager or Vault:

1. Set `SECRET_PROVIDER=aws` or `SECRET_PROVIDER=vault` in `.env`
2. Configure the appropriate credentials (see Configuration section)
3. Update your services to use `SecretsManagerService` or `VaultSecretsService`
4. Test thoroughly before deploying to production

---

## Monitoring & Observability

### Logs to Monitor

- `AWS Secrets Manager initialized` / `Vault integration initialized`
- `Failed to retrieve secret: {name}` - Indicates permission or connectivity issues
- `Secret rotated successfully: {name}` - Rotation events
- `Error acquiring idempotency lock` - Redis connectivity issues
- `Request is being processed, please wait` - High concurrency scenarios

### Metrics to Track

- Secret cache hit rate
- Idempotency cache hit rate (deduplication effectiveness)
- Number of secret rotations
- Idempotency lock conflicts

---

## Best Practices

### Secrets Management
- ✅ Rotate secrets regularly (automated weekly rotation enabled)
- ✅ Use least-privilege IAM policies for AWS Secrets Manager
- ✅ Vault tokens should have minimal required permissions
- ✅ Never log secret values (automatically redacted)
- ✅ Monitor failed secret access attempts

### Idempotency
- ✅ Generate UUIDs client-side for idempotency keys
- ✅ Reuse the same key for retry attempts
- ✅ Set appropriate TTL based on business requirements
- ✅ Monitor 409 Conflict responses for client-side issues
- ✅ Apply to all non-idempotent operations (payments, subscriptions, etc.)

---

## Troubleshooting

### Secrets Not Found
- Verify `SECRET_PROVIDER` is set correctly
- Check AWS IAM permissions or Vault token permissions
- Ensure secret names match exactly (case-sensitive)
- Check network connectivity to AWS/Vault

### Idempotency Not Working
- Verify `X-Idempotency-Key` header is present
- Check Redis connectivity and credentials
- Ensure TTL is appropriate for your use case
- Review logs for lock acquisition failures

### Performance Issues
- Adjust `SECRET_CACHE_TTL_MS` to reduce AWS/Vault calls
- Monitor Redis memory usage for idempotency records
- Consider reducing `IDEMPOTENCY_TTL_SECONDS` if storage is high

---

## Future Enhancements

- [ ] Support for Azure Key Vault
- [ ] Secret versioning and rollback
- [ ] Idempotency key auto-generation middleware
- [ ] Dashboard for monitoring secret rotations
- [ ] Analytics on idempotency effectiveness
- [ ] Database-backed idempotency storage (alternative to Redis)

---

## References

- Issue #355: https://github.com/rinafcode/teachLink_backend/issues/355
- Issue #384: https://github.com/rinafcode/teachLink_backend/issues/384
- AWS Secrets Manager Docs: https://docs.aws.amazon.com/secretsmanager/
- HashiCorp Vault Docs: https://www.vaultproject.io/docs
- Idempotency Best Practices: https://en.wikipedia.org/wiki/Idempotence
