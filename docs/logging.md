# Logging Standards — TeachLink Backend

> Issue [#536](https://github.com/rinafcode/teachLink_backend/issues/536)

---

## Overview

TeachLink backend uses a centralised, structured logging system built on top of NestJS's
built-in `ConsoleLogger`.  Every log line is emitted as a **single-line JSON object** so
that log-shipping tools (Filebeat, Fluent Bit, CloudWatch Logs Insights, Datadog, etc.)
can parse and index individual fields without regular expressions.

---

## Architecture

```
src/logging/
├── app-logger.service.ts        # Core logger — inject this everywhere
├── app-logger.service.spec.ts   # Unit tests for AppLoggerService
├── logging.interceptor.ts       # Global HTTP request/response logger
├── logging.interceptor.spec.ts  # Unit tests for LoggingInterceptor
├── logging.middleware.ts        # Correlation-ID propagation middleware
├── logging.module.ts            # @Global NestJS module — import once in AppModule
├── redaction.util.ts            # Sensitive-data redaction helper
└── redaction.util.spec.ts       # Unit tests for redaction
```

All modules import `LoggingModule` **indirectly** (it is `@Global()`), so only
`AppModule` needs to explicitly import it.

---

## Log Record Shape

Every emitted record conforms to `IAppLogRecord`:

```jsonc
{
  "level": "info",               // debug | info | warn | error | fatal
  "message": "User enrolled",    // human-readable description
  "context": "CoursesService",   // NestJS context / class name
  "correlationId": "cid-...",    // request trace ID (from x-request-id header)
  "timestamp": "2026-07-01T17:18:27.123Z",
  "metadata": {                  // optional – all sensitive fields redacted
    "courseId": "c-123",
    "userId": "u-456",
    "type": "business_event"
  },
  "error": {                     // only present on error / fatal calls
    "name": "Error",
    "message": "Connection refused",
    "stack": "Error: Connection refused\n  at ..."
  }
}
```

---

## Log Levels — Usage Guide

| Level   | When to use                                                                                         |
|---------|-----------------------------------------------------------------------------------------------------|
| `debug` | Internal state, SQL queries, algorithm steps.  Disabled by default in production.                  |
| `info`  | Normal operational events: requests completed, jobs processed, user actions recorded.               |
| `warn`  | Recoverable anomalies: retries, degraded mode, slow queries, deprecated feature usage.              |
| `error` | Unexpected failures that need investigation but did not crash the process.                          |
| `fatal` | Critical failures that require immediate operator action (DB unreachable, OOM, startup failure).    |

---

## Correlation IDs

The correlation ID is a short unique string that is attached to **every log line
generated within a single HTTP request**.  This allows you to search for all logs
from one request across all services.

Flow:
1. `correlationMiddleware` (registered in `main.ts`) reads `x-request-id` from the
   incoming request header, or generates a new one (`cid-<timestamp>-<random>`).
2. The ID is stored in `AsyncLocalStorage` (thread-local equivalent for Node.js).
3. `AppLoggerService._emit()` calls `getCorrelationId()` from that storage on every
   log call — no manual threading required.
4. `LoggingInterceptor` and `LoggingMiddleware` echo the ID back in the response
   header so that API callers can record it and use it for support tickets.

To trace a request end-to-end, search your log system for:

```
correlationId:"cid-lxj83k-abcdef12"
```

---

## Sensitive Data Redaction

`redactSensitiveData()` (in `redaction.util.ts`) is called automatically on every
`metadata` payload before the log is serialised.

### Redacted by default

Any key whose **lower-cased name contains** one of these substrings will have its
value replaced with `"[REDACTED]"`:

```
password, passwd, secret, token, apikey, api_key, accesskey, access_key,
privatekey, private_key, clientsecret, client_secret, authorization, auth,
bearer, credential, ssn, creditcard, credit_card, cardnumber, card_number,
cvv, cvc, pin, otp, mfa, signature, webhook_secret, signing_key,
encryption_key, jwt, refresh_token, id_token
```

### Example

```ts
logger.info('login attempt', {
  username: 'alice',
  password: 'hunter2',         // → "[REDACTED]"
  accessToken: 'eyJhbGc...',   // → "[REDACTED]"
});
```

Resulting log record:

```json
{
  "level": "info",
  "message": "login attempt",
  "metadata": {
    "username": "alice",
    "password": "[REDACTED]",
    "accessToken": "[REDACTED]"
  }
}
```

---

## Usage

### 1. Inject AppLoggerService

```typescript
import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../logging/app-logger.service';

@Injectable()
export class CoursesService {
  constructor(private readonly logger: AppLoggerService) {
    this.logger.setContext(CoursesService.name);
  }

  async enroll(userId: string, courseId: string): Promise<void> {
    this.logger.info('Enrolling user', { userId, courseId });

    try {
      // ... business logic
      this.logger.logEvent('user.enrolled', { userId, courseId });
    } catch (err) {
      this.logger.error('Enrollment failed', err as Error, { userId, courseId });
      throw err;
    }
  }
}
```

### 2. HTTP request logging (automatic)

`LoggingInterceptor` is registered globally via `APP_INTERCEPTOR` in `LoggingModule`.
You do not need to add anything to individual controllers.

Every request emits two lines automatically:

```json
{ "level": "debug", "message": "→ POST /courses/enroll", ... }
{ "level": "info",  "message": "POST /courses/enroll 201", "metadata": { "durationMs": 14 } }
```

### 3. Forwarding correlation ID in outbound HTTP calls

```typescript
import {
  getCorrelationId,
  CORRELATION_ID_HEADER,
  injectCorrelationIdToHeaders,
} from '../common/utils/correlation.utils';

// Using the helper
const headers = injectCorrelationIdToHeaders({ 'content-type': 'application/json' });
await this.httpService.post(url, body, { headers });
```

---

## Configuration

| Environment variable | Default       | Description                                                                   |
|----------------------|---------------|-------------------------------------------------------------------------------|
| `LOG_LEVEL`          | `log`         | NestJS built-in: `debug`, `log`, `warn`, `error`, `fatal`                    |
| `NODE_ENV`           | `development` | Controls log verbosity in some external tools (no effect on NestJS directly). |

Set `LOG_LEVEL=debug` in development to see SQL queries and algorithm steps.
Set `LOG_LEVEL=warn` in production to reduce noise (error and fatal still emitted).

### NestJS bootstrap

To pass `LOG_LEVEL` to NestJS at startup:

```typescript
// main.ts
const app = await NestFactory.create(AppModule, {
  logger: (process.env.LOG_LEVEL?.split(',') as LogLevel[]) ?? ['log', 'warn', 'error', 'fatal'],
});
```

---

## Testing

```bash
# Run only logging tests
npx jest src/logging --testPathPattern="logging|redaction|app-logger"

# Run all unit tests with coverage
npm run test:ci
```

---

## Integration with External Systems

The JSON format is compatible with:

- **Elasticsearch / Kibana** — index via Filebeat or Fluent Bit; map `level`, `correlationId`, `timestamp` as keyword fields.
- **AWS CloudWatch Logs Insights** — query with `fields @message | filter level = "error"`.
- **Datadog** — auto-parsed by the Node.js tracer; set `DD_LOGS_INJECTION=true` to auto-inject trace IDs.
- **Grafana Loki** — ship via `promtail`; label streams by `level` and `context`.

See `logging/shipper/filebeat.yml` for a working Filebeat configuration.
