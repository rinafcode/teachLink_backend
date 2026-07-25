# API Security Best Practices

This document covers security guidelines for TeachLink backend developers, aligned with the OWASP Top 10.

---

## Table of Contents

1. [OWASP Top 10 Coverage](#owasp-top-10)
2. [Best Practices by Domain](#best-practices-by-domain)
3. [Code Examples](#code-examples)
4. [Security Checklist](#security-checklist)

---

## OWASP Top 10

### A01 – Broken Access Control

Enforce authorization at the service layer, not just the route level. Use `@Roles()` and `RolesGuard` on every protected endpoint.

```typescript
// ✅ Correct – guard applied at controller level
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Delete(':id')
remove(@Param('id') id: string) { ... }

// ❌ Wrong – no authorization guard
@Delete(':id')
remove(@Param('id') id: string) { ... }
```

Never trust the client-supplied user ID for ownership checks. Always derive the owner from the JWT:

```typescript
// ✅ Correct
async update(courseId: string, dto: UpdateCourseDto, @CurrentUser() user: User) {
  const course = await this.coursesService.findOne(courseId);
  if (course.instructorId !== user.id) throw new ForbiddenOperationException();
  ...
}
```

### A02 – Cryptographic Failures

- Use `EncryptionService` (AES-256-GCM) for sensitive fields at rest.
- Never store plaintext passwords. Use bcrypt with ≥ 10 rounds in production (`BCRYPT_ROUNDS` env var).
- Transmit data over HTTPS only. Never log secrets, tokens, or PII.

```typescript
// ✅ Encrypt sensitive data before persisting
const encrypted = this.encryptionService.encrypt(sensitiveValue);
entity.sensitiveField = JSON.stringify(encrypted);
```

### A03 – Injection

All database access goes through TypeORM parameterized queries. Never interpolate user input into raw SQL.

```typescript
// ✅ Correct – parameterized
repo.findOne({ where: { email } });

// ❌ Wrong – raw string interpolation
repo.query(`SELECT * FROM users WHERE email = '${email}'`);
```

For search/LIKE patterns, use the provided sanitizer:

```typescript
import { sanitizeSqlLike } from '../common/utils/sanitization.utils';

const safe = sanitizeSqlLike(userInput);
repo.createQueryBuilder('u').where('u.name LIKE :q', { q: `%${safe}%` });
```

### A04 – Insecure Design

- Validate all inputs with `class-validator` DTOs and the global `ValidationPipe`.
- Apply the principle of least privilege: services only receive the data they need.
- Use idempotency keys (`@Idempotency()`) on mutating endpoints to prevent duplicate operations.

```typescript
// main.ts – global validation pipe is already configured
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
```

### A05 – Security Misconfiguration

- All secrets come from environment variables, never from source code.
- Helmet is applied globally in `main.ts` for secure HTTP headers.
- CORS is configured via `cors.config.ts`; restrict `origin` to known domains in production.
- Disable debug endpoints (`/debug/*`) in production via the `ENABLE_DEBUG_MODULE` feature flag.

### A06 – Vulnerable and Outdated Components

- Pin dependency versions in `package.json` (no open ranges like `^` or `~` for security-sensitive packages).
- Run `npm audit` in CI. The pipeline fails on high/critical vulnerabilities.
- Review `scripts/scan-licenses.js` output before releasing.

### A07 – Identification and Authentication Failures

- JWT tokens are short-lived. Refresh tokens are stored in Redis sessions (`SessionService`).
- Brute-force protection is provided by `ThrottleMiddleware` and `CustomThrottleGuard`.
- Wallet-based login (Starknet) must verify the signature server-side before issuing a JWT.
- Invalidate sessions on password change and logout.

```typescript
// ✅ Always verify JWT before trusting claims
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@CurrentUser() user: User) { ... }
```

### A08 – Software and Data Integrity Failures

- Stripe webhook signatures are verified by `WebhookSecurityService` using HMAC-SHA256.
- Replay attacks are blocked by a 5-minute timestamp window and a processed-event ID cache.
- Never deserialize untrusted data with `eval` or `Function()`.

```typescript
// WebhookSecurityService already handles this:
const result = await this.webhookSecurityService.verifyStripeWebhook(rawBody, signature);
if (!result.valid) throw new UnauthorizedException(result.reason);
```

### A09 – Security Logging and Monitoring Failures

Use `AuditLoggerService` for all security-relevant events. Do not log raw passwords, tokens, or full credit card numbers.

```typescript
await this.auditLogger.logAuth({
  userId: user.id,
  action: AuditAction.LOGIN,
  ipAddress: req.ip,
  success: true,
});
```

Suspicious activity (repeated failures, unusual access patterns) is tracked by `ThreatDetectionService` and triggers alerts via `AlertingService`.

### A10 – Server-Side Request Forgery (SSRF)

- Validate and allowlist URLs before making outbound HTTP requests.
- Never forward user-supplied URLs directly to `fetch` / `axios` without validation.
- Internal service URLs must come from environment configuration, not user input.

```typescript
// ✅ Use allowlisted base URLs from config
const baseUrl = this.configService.get<string>('INTERNAL_SERVICE_URL');
await axios.get(`${baseUrl}/internal/resource`);

// ❌ Never do this
await axios.get(userSuppliedUrl);
```

---

## Best Practices by Domain

### Authentication & Sessions

- Rotate JWT secrets periodically via `SecretsManagerService`.
- Store session state in Redis, not in JWTs, to allow instant revocation.
- Set `httpOnly` and `Secure` flags on session cookies.
- Enforce MFA for admin roles.

### Input Validation

- Every controller parameter must be typed with a DTO decorated with `class-validator`.
- Use `@IsUUID()` for ID parameters to prevent injection via path params.
- Strip unknown fields with `whitelist: true` on `ValidationPipe`.
- Sanitize HTML/markdown content before storage to prevent stored XSS.

### Rate Limiting & Quota

- Global throttle is applied in `main.ts` via `ThrottleModule`.
- Per-user quota is enforced by `QuotaGuard` using `QuotaTrackingService`.
- Adaptive rate limiting (`AdaptiveRateLimitingService`) adjusts limits under load.

### Data Privacy

- PII fields are masked in API responses by `MaskingInterceptor` based on the caller's role.
- `DataAnonymizationService` is used for analytics exports.
- GDPR data export and deletion are handled by `ComplianceService`.
- Audit logs retain PII only for the configured retention period (`AuditRetentionTask`).

### Secrets Management

- Retrieve secrets at runtime via `SecretsManagerService` (AWS Secrets Manager) or `VaultSecretsService` (HashiCorp Vault).
- Never commit `.env` files. Use `.env.example` with placeholder values.
- Rotate secrets without downtime using the `/secrets/rotate` endpoint (admin only).

---

## Code Examples

### Protecting an Endpoint End-to-End

```typescript
@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard, QuotaGuard)
@ApiHeader({ name: 'X-API-Version', required: true })
export class CoursesController {
  @Post()
  @Roles(Role.INSTRUCTOR)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCourseDto,   // validated & whitelisted by global ValidationPipe
    @CurrentUser() user: User,
  ) {
    return this.coursesService.create(dto, user.id);
  }
}
```

### Validating a DTO

```typescript
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  title: string;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;
}
```

### Logging a Security Event

```typescript
// In a service method
await this.auditLogger.logSecurityEvent({
  userId: user.id,
  action: AuditAction.PERMISSION_DENIED,
  resource: 'course',
  resourceId: courseId,
  ipAddress: request.ip,
  details: { reason: 'not_owner' },
});
```

### Encrypting a Sensitive Field

```typescript
// Storing
const payload = this.encryptionService.encrypt(walletPrivateKey);
user.encryptedKey = JSON.stringify(payload);

// Retrieving
const payload: IEncryptedPayload = JSON.parse(user.encryptedKey);
const privateKey = this.encryptionService.decrypt(payload);
```

---

## Security Checklist

Use this checklist when reviewing a PR that touches security-sensitive code.

### Authentication & Authorization
- [ ] All non-public endpoints have `@UseGuards(JwtAuthGuard)`
- [ ] Role-restricted endpoints have `@UseGuards(RolesGuard)` and `@Roles(...)`
- [ ] Ownership is verified from the JWT, not from a request body field
- [ ] Admin-only endpoints are tested with a non-admin token (expect 403)

### Input Handling
- [ ] Every `@Body()` parameter uses a DTO with `class-validator` decorators
- [ ] `ValidationPipe` is applied globally with `whitelist: true`
- [ ] Path/query params are typed (`@IsUUID()`, `@IsInt()`, etc.)
- [ ] User-supplied strings are not interpolated into raw SQL or shell commands

### Secrets & Configuration
- [ ] No secrets, API keys, or passwords in source code or committed `.env` files
- [ ] New environment variables are documented in `.env.example`
- [ ] Secrets are loaded via `ConfigService` or `SecretsManagerService`

### Cryptography
- [ ] Passwords hashed with bcrypt (`BCRYPT_ROUNDS` ≥ 10 in production)
- [ ] Sensitive fields encrypted with `EncryptionService` (AES-256-GCM)
- [ ] No use of MD5 or SHA-1 for security purposes

### Webhooks & External Integrations
- [ ] Incoming webhook signatures verified before processing payload
- [ ] Replay attack prevention in place (timestamp + event ID check)
- [ ] Outbound HTTP requests use allowlisted base URLs from config

### Logging & Monitoring
- [ ] Security events logged via `AuditLoggerService`
- [ ] No PII, passwords, or tokens in log output
- [ ] Sensitive operations decorated with `@SensitiveOperation()`

### Rate Limiting & Abuse Prevention
- [ ] Mutating endpoints covered by throttle guard
- [ ] Expensive operations (search, export) have quota limits
- [ ] Idempotency key used on payment and enrollment endpoints

### Dependencies
- [ ] `npm audit` passes with no high/critical findings
- [ ] New packages are well-known and actively maintained
- [ ] Package versions are pinned for security-sensitive libraries

---

*For questions or to report a vulnerability, contact the security team or open a confidential issue.*
