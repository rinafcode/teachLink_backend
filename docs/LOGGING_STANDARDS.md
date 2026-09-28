# Logging Standards Documentation

## Overview

This document describes the logging standards and configuration for the TeachLink Backend application. The logging system provides structured, consistent logging across all modules with proper log levels, correlation IDs, and sensitive data protection.

## Architecture

### Components

1. **AppLoggerService** (`src/logging/logger.service.ts`)
   - Winston-based logger service
   - Implements NestJS LoggerService interface
   - Provides structured JSON logging
   - Supports file and console transports

2. **Sensitive Data Masker** (`src/logging/sensitive-data.masker.ts`)
   - Automatically masks sensitive fields in log output
   - Recursively masks nested objects and arrays
   - Case-insensitive key matching

3. **Correlation ID Utilities** (`src/common/utils/correlation.utils.ts`)
   - Generates and propagates correlation IDs across requests
   - AsyncLocalStorage-based context propagation
   - Supports both canonical and legacy header names

4. **HTTP Logging Interceptor** (`src/logging/http-logging.interceptor.ts`)
   - Logs all HTTP requests and responses
   - Includes correlation IDs, duration, and status codes
   - Masks sensitive data in request bodies

5. **Structured Logging** (`src/logging/structured-logging.ts`)
   - Console-based structured logging fallback
   - Overrides console methods for consistent output
   - Handles uncaught exceptions and rejections

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LOG_LEVEL` | Minimum log level to output | `info` | No |
| `LOG_DIR` | Directory for log files | `logs` | No |
| `LOG_TO_FILE` | Enable file logging | `false` (true in production) | No |
| `SERVICE_NAME` | Service name for log identification | `teachlink-backend` | No |
| `NODE_ENV` | Environment (production/development) | - | No |

### Log Levels

The following log levels are supported, ordered from most to least severe:

1. **error** - Error events that might still allow the application to continue running
2. **warn** - Potentially harmful situations
3. **info** - Informational messages that highlight the progress of the application
4. **debug** - Fine-grained informational events that are most useful to debug an application
5. **verbose** - Detailed information typically only of interest when diagnosing problems

### Log Format

All logs are output in structured JSON format:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "service": "teachlink-backend",
  "pid": 12345,
  "correlationId": "cid-abc123-xyz789",
  "message": "User logged in successfully",
  "context": "AuthService",
  "meta": {
    "userId": "user_123",
    "email": "user@example.com"
  }
}
```

### File Rotation

When file logging is enabled, logs are rotated daily:

- **Application logs**: `logs/app-YYYY-MM-DD.log`
  - Max size: 20MB per file
  - Retention: 14 days
  
- **Error logs**: `logs/error-YYYY-MM-DD.log`
  - Max size: 20MB per file
  - Retention: 30 days
  - Only contains error-level logs

## Usage

### Injecting the Logger

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { AppLoggerService } from '../logging/logger.service';

@Injectable()
export class UserService {
  constructor(private readonly logger: AppLoggerService) {}

  createUser(userData: CreateUserDto) {
    this.logger.log('Creating new user', 'UserService');
    // ... business logic
    this.logger.debug('User created successfully', 'UserService');
  }
}
```

### Log Level Methods

```typescript
// Info level - general informational messages
this.logger.log('User logged in', 'AuthService');

// Debug level - detailed debugging information
this.logger.debug('Processing payment with ID: payment_123', 'PaymentService');

// Warn level - potentially harmful situations
this.logger.warn('Rate limit approaching for user: user_123', 'RateLimitService');

// Error level - error events
this.logger.error('Failed to process payment', error.stack, 'PaymentService');

// Verbose level - very detailed information
this.logger.verbose('Cache hit for key: user_profile_123', 'CacheService');
```

### Logging with Metadata

```typescript
this.logger.log('User action completed', 'UserService');
// Metadata is automatically included via correlation ID and context

// For custom metadata, use the winston logger directly
this.logger.logRequest({
  method: 'POST',
  url: '/api/users',
  userId: 'user_123',
  action: 'create_user'
});

this.logger.logResponse({
  statusCode: 201,
  durationMs: 45,
  userId: 'user_123'
});
```

### Correlation IDs

Correlation IDs are automatically propagated through the request context:

```typescript
import { getCorrelationId, runWithCorrelationId } from '../common/utils/correlation.utils';

// Get current correlation ID
const correlationId = getCorrelationId();

// Run code with a specific correlation ID (useful for background jobs)
runWithCorrelationId(() => {
  this.logger.log('Processing background job', 'JobService');
}, 'cid-job-123');
```

## Sensitive Data Protection

### Automatically Masked Fields

The following field names are automatically masked in log output:

- `password`, `passwd`, `pass`
- `secret`
- `token`, `accesstoken`, `access_token`, `refreshtoken`, `refresh_token`
- `apikey`, `api_key`, `apitoken`, `api_token`
- `authorization`, `auth`
- `key`, `privatekey`, `private_key`
- `clientsecret`, `client_secret`
- `credit_card`, `creditcard`, `cardnumber`, `card_number`
- `cvv`, `cvc`
- `pin`
- `ssn`, `socialsecuritynumber`, `social_security_number`

### Masking Behavior

- Masked values are replaced with `***MASKED***`
- Masking is case-insensitive
- Nested objects and arrays are recursively masked
- Primitive values (strings, numbers, booleans) are passed through unchanged

### Example

```typescript
const userData = {
  email: 'user@example.com',
  password: 'secret123',
  profile: {
    name: 'John Doe',
    ssn: '123-45-6789'
  }
};

// In logs, this becomes:
{
  email: 'user@example.com',
  password: '***MASKED***',
  profile: {
    name: 'John Doe',
    ssn: '***MASKED***'
  }
}
```

## HTTP Request Logging

All HTTP requests are automatically logged with the following information:

### Request Log
```json
{
  "event": "http_request",
  "correlationId": "cid-abc123",
  "method": "POST",
  "url": "/api/users",
  "headers": {
    "content-type": "application/json",
    "authorization": "***MASKED***"
  },
  "remoteAddress": "192.168.1.1",
  "body": {
    "email": "user@example.com",
    "password": "***MASKED***"
  }
}
```

### Response Log
```json
{
  "event": "http_response",
  "correlationId": "cid-abc123",
  "method": "POST",
  "url": "/api/users",
  "statusCode": 201,
  "durationMs": 45
}
```

### Error Log
```json
{
  "event": "http_error",
  "correlationId": "cid-abc123",
  "method": "POST",
  "url": "/api/users",
  "statusCode": 500,
  "durationMs": 120,
  "error": {
    "message": "Database connection failed",
    "name": "DatabaseError"
  }
}
```

## Best Practices

### DO

- Use appropriate log levels for each situation
- Include context information (service/module name)
- Use correlation IDs for tracing requests across services
- Log business-critical events (user actions, state changes)
- Log errors with stack traces for debugging
- Keep log messages concise and meaningful

### DON'T

- Log sensitive data (passwords, tokens, PII)
- Use console.log directly (use the logger service)
- Log at debug level in production (use info or warn)
- Log large objects (truncate or summarize)
- Log the same event multiple times
- Include stack traces for non-error logs

### Log Level Guidelines

| Situation | Log Level | Example |
|-----------|-----------|---------|
| Application startup/shutdown | info | "Application started on port 3000" |
| User actions | info | "User created account", "User logged in" |
| Business logic milestones | info | "Payment processed successfully" |
| Performance issues | warn | "Slow query detected: 2000ms" |
- Deprecated API usage | warn | "Using deprecated endpoint /api/v1/users" |
| Configuration issues | warn | "Missing env var, using default" |
| Application errors | error | "Failed to connect to database" |
- Validation failures | error | "Invalid user input" |
| Detailed debugging | debug | "Cache miss for key: user_123" |
| Function entry/exit | debug | "Entering method: processPayment" |
| Very detailed tracing | verbose | "Processing item 1 of 100" |

## Testing

### Unit Tests

Run logging service tests:

```bash
npm test -- src/logging/logger.service.spec.ts
npm test -- src/logging/sensitive-data.masker.spec.ts
npm test -- src/logging/http-logging.interceptor.spec.ts
```

### Integration Tests

Verify logging integration:

```bash
npm run test:e2e
```

## Troubleshooting

### Logs Not Appearing

1. Check `LOG_LEVEL` environment variable
2. Verify `LOG_TO_FILE` is set correctly for file logging
3. Ensure the logging module is imported in `AppModule`

### Correlation IDs Missing

1. Verify `CorrelationIdMiddleware` is registered in `main.ts`
2. Check that `requestIdMiddleware` is applied
3. Ensure correlation headers are passed from upstream services

### Sensitive Data Leaking

1. Check if the field name is in the `SENSITIVE_KEYS` set
2. Verify the masker is being called on all log output
3. Add custom field names to the masker if needed

### Performance Issues

1. Reduce log level from `debug` to `info` in production
2. Disable file logging if not needed
3. Check log file rotation settings
4. Avoid logging large objects

## Migration Guide

### Migrating from Console.log

**Before:**
```typescript
console.log('User created:', userData);
console.error('Error:', error);
```

**After:**
```typescript
this.logger.log('User created', 'UserService');
this.logger.error('Failed to create user', error.stack, 'UserService');
```

### Migrating from NestJS Logger

**Before:**
```typescript
import { Logger } from '@nestjs/common';

private logger = new Logger(UserService.name);
this.logger.log('User created');
```

**After:**
```typescript
import { AppLoggerService } from '../logging/logger.service';

constructor(private readonly logger: AppLoggerService) {}
this.logger.log('User created', 'UserService');
```

## Additional Resources

- [Winston Documentation](https://github.com/winstonjs/winston)
- [NestJS Logging](https://docs.nestjs.com/techniques/logger)
- [Correlation ID Pattern](https://microservices.io/patterns/observability/correlation-id.html)
