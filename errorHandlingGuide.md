# TeachLink Backend — Developer Guide

## Error Handling

All modules use the custom exceptions from `src/common/exceptions/app.exceptions.ts`.
**Never** throw NestJS built-in exceptions directly in services or controllers — use the custom classes below instead.

### Exception mapping

| Scenario | Class | HTTP |
|---|---|---|
| Resource not found (by id or field) | `ResourceNotFoundException(resource, id?)` | 404 |
| Business rule / state violation | `BusinessValidationException(message)` | 422 |
| Duplicate resource | `ResourceConflictException(resource, field?)` | 409 |
| Access denied (ownership/role) | `ForbiddenOperationException(message?)` | 403 |
| Bad credentials / user not found in JWT | `InvalidCredentialsException(message?)` | 401 |
| Token expired or already used | `InvalidTokenException(message?)` | 401 |
| External service down | `ServiceUnavailableException(service)` | 503 |
| Rate limit exceeded | `RateLimitExceededException(retryAfterSeconds?)` | 429 |

**Exceptions still using NestJS built-ins (by design):**
- `BadRequestException` — raw input / parse validation (400), e.g. invalid JSON, missing header
- `UnauthorizedException` — authentication context missing, e.g. no JWT, missing tenant context

### GlobalExceptionFilter

Registered globally in `AppModule`. It:
- Returns a consistent `{ success, statusCode, message, path, timestamp, correlationId }` envelope
- Logs all non-HTTP exceptions and 5xx responses via NestJS `Logger`

### Pattern examples

```typescript
// Not found
throw new ResourceNotFoundException('Course', courseId);

// Business rule violation
throw new BusinessValidationException('Cannot submit a PUBLISHED course for review.');

// Duplicate
throw new ResourceConflictException('Tenant', 'slug');

// Auth
throw new InvalidCredentialsException('User not found');

// Rate limit
throw new RateLimitExceededException(60); // retry in 60 s
```
