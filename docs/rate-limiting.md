# Rate Limiting

The API uses a preset-based rate limiting system that applies different limits depending on the sensitivity of the endpoint.

## Rate Limit Presets

| Preset | Limit | Window | Endpoints |
|--------|-------|--------|-----------|
| `STRICT` | 3 requests | per hour | Registration, sensitive operations |
| `AUTH_LOGIN` | 5 requests | per 15 minutes | Login attempts |
| `AUTH_DEFAULT` | 5 requests | per hour | Password reset, forgot password |
| `MODERATE` | 10 requests | per hour | Payments, media uploads |
| `REFRESH` | 20 requests | per minute | Token refresh |
| `SEARCH` | 30 requests | per minute | Search endpoints |
| `QUEUE_ADMIN` | 60 requests | per minute | Admin queue operations |

## Response Headers

Every API response includes rate limit headers when the `CustomThrottleGuard` is active:

```text
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 1719230400
```

When the limit is exceeded:

```text
HTTP/1.1 429 Too Many Requests
Retry-After: 3600
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1719230400
```

## Error Response

```json
{
  "success": false,
  "statusCode": 429,
  "message": "You have exceeded the request rate limit. Please wait before retrying.",
  "error": "Too Many Requests",
  "retryAfterSeconds": 3600,
  "path": "/api/v1/auth/register",
  "timestamp": "2026-06-24T10:00:00.000Z",
  "correlationId": "req-abc-123-def"
}
```

## How to Handle Rate Limits

1. Check the `Retry-After` header — it tells you how many seconds to wait
2. Check `X-RateLimit-Remaining` before making requests to know your budget
3. Implement exponential backoff in your client
4. Authenticated requests may have different (usually higher) limits

## Configuration

Rate limit presets are defined in `src/common/constants/throttle.constants.ts`. The `CustomThrottleGuard` (`src/common/guards/throttle.guard.ts`) extends NestJS's built-in `ThrottlerGuard` to return structured error responses.

Rate limiting can be disabled via the `ENABLE_RATE_LIMITING` feature flag (see `src/config/feature-flags.config.ts`).
