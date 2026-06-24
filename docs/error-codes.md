# Error Codes & Responses

All API errors follow a consistent response envelope and use custom exception classes.

## Response Envelope

Every error response returns this JSON structure:

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Course with id 'abc-123' was not found",
  "path": "/api/v1/courses/abc-123",
  "timestamp": "2026-06-24T10:00:00.000Z",
  "correlationId": "req-abc-123-def"
}
```

## HTTP Status Code Reference

| Status | Code | Scenario | Exception Class |
|--------|------|----------|----------------|
| 400 | `BAD_REQUEST` | Invalid JSON, missing headers, malformed input | `BadRequestException` (NestJS built-in) |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT, no auth context | `UnauthorizedException` (NestJS built-in) |
| 401 | `INVALID_CREDENTIALS` | Bad credentials, user not found in JWT | `InvalidCredentialsException` |
| 401 | `INVALID_TOKEN` | Token expired, already used, or invalid | `InvalidTokenException` |
| 403 | `FORBIDDEN` | Authenticated but insufficient permissions | `ForbiddenOperationException` |
| 404 | `NOT_FOUND` | Resource does not exist | `ResourceNotFoundException` |
| 409 | `CONFLICT` | Duplicate resource (email, slug, etc.) | `ResourceConflictException` |
| 422 | `UNPROCESSABLE_ENTITY` | Business rule violation (valid JSON, bad semantics) | `BusinessValidationException` |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded | `RateLimitExceededException` |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error (never exposes internals) | Unhandled exceptions |
| 503 | `SERVICE_UNAVAILABLE` | External dependency is down | `ServiceUnavailableException` |

## Custom Exception Reference

### `ResourceNotFoundException` (404)

```typescript
throw new ResourceNotFoundException('Course', courseId);
// => "Course with id 'abc-123' was not found"

throw new ResourceNotFoundException('User');
// => "User was not found"
```

### `ForbiddenOperationException` (403)

```typescript
throw new ForbiddenOperationException();
// => "You do not have permission to perform this action"

throw new ForbiddenOperationException('Only course instructors can publish courses');
```

### `ResourceConflictException` (409)

```typescript
throw new ResourceConflictException('User', 'email');
// => "User with this email already exists"

throw new ResourceConflictException('Tenant');
// => "Tenant already exists"
```

### `BusinessValidationException` (422)

```typescript
throw new BusinessValidationException('Cannot submit a PUBLISHED course for review.');
```

### `InvalidCredentialsException` (401)

```typescript
throw new InvalidCredentialsException('User not found');
// => "User not found"

throw new InvalidCredentialsException();
// => "Invalid credentials"
```

### `InvalidTokenException` (401)

```typescript
throw new InvalidTokenException('Password reset token has expired');
// => "Password reset token has expired"

throw new InvalidTokenException();
// => "Invalid or expired token"
```

### `ServiceUnavailableException` (503)

```typescript
throw new ServiceUnavailableException('Elasticsearch');
// => "Elasticsearch is currently unavailable. Please try again later."
```

### `RateLimitExceededException` (429)

```typescript
throw new RateLimitExceededException(60);
// Returns:
// {
//   message: "You have exceeded the request rate limit. Please wait before retrying.",
//   error: "Too Many Requests",
//   statusCode: 429,
//   retryAfterSeconds: 60
// }
```

## Validation Errors

DTO validation failures (class-validator) return HTTP 400 with field-level details:

```json
{
  "success": false,
  "statusCode": 400,
  "message": ["email must be a valid email address", "name should not be empty"],
  "path": "/api/v1/auth/register",
  "timestamp": "2026-06-24T10:00:00.000Z",
  "correlationId": "req-abc-123-def"
}
```

## Rate Limit Error Response

When rate limited, the response includes standard headers:

```text
HTTP/1.1 429 Too Many Requests
Retry-After: 3600
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1719230400
```

See [rate-limiting.md](./rate-limiting.md) for details on rate limit tiers.
