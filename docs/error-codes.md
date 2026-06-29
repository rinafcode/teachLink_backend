# Standardized API Error Codes

This document lists the standardized API error codes used across the TeachLink backend system. All error responses return a standardized JSON structure:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Invalid credentials",
    "statusCode": 401,
    "timestamp": "2026-05-26T10:30:00Z",
    "requestId": "req-123456"
  }
}
```

## Error Codes Mapping

| Error Code | HTTP Status | Exception Class | Description |
|---|---|---|---|
| **`AUTH_001`** | 401 Unauthorized | `InvalidCredentialsException` | The username or password provided is incorrect. |
| **`AUTH_002`** | 401 Unauthorized | `InvalidTokenException` | The authentication token (e.g. password reset token) is invalid, expired, or already used. |
| **`AUTH_003`** | 403 Forbidden | `ForbiddenOperationException` | The user does not have permission to perform this action. |
| **`AUTH_004`** | 401 Unauthorized | `UnauthorizedException` (built-in) | Authentication context is missing (e.g., missing JWT). |
| **`RES_001`** | 404 Not Found | `ResourceNotFoundException` | The requested resource (course, user, etc.) could not be found. |
| **`RES_002`** | 409 Conflict | `ResourceConflictException` | A duplicate resource conflict occurred (e.g., email already registered). |
| **`VAL_001`** | 400 Bad Request | `BadRequestException` (built-in) | Input data failed validation or parsing constraints. |
| **`BUS_001`** | 422 Unprocessable Entity | `BusinessValidationException` | A business logic or state machine transition rule was violated. |
| **`SYS_001`** | 500 Internal Server Error | Generic / Unhandled | An unexpected error occurred on the server. |
| **`SYS_002`** | 503 Service Unavailable | `ServiceUnavailableException` | An external dependency or service is currently down or unreachable. |
| **`SYS_003`** | 429 Too Many Requests | `RateLimitExceededException` | The request limit has been exceeded. |
