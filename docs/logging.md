**Structured Logging**

- **Format**: JSON per-line logs with fields: `timestamp`, `level`, `service`, `pid`, `message`, `meta`, `data`.
- **Initialization**: The application initializes structured logging on startup via `initStructuredLogging()` in `src/main.ts`.
- **Request tracing**: Each HTTP request gets an `x-request-id` header and two logs: `request_start` and `request_end` with `durationMs` and `statusCode`.

Recommendations for aggregation and parsing:
- Send stdout/stderr to your log collector (CloudWatch, Datadog, ELK, Splunk). The logs are JSON so they can be indexed and searched.
- Use `service` and `requestId` fields to correlate traces across services.

If you want to switch to a production logger (pino/winston), replace `src/logging/structured-logging.ts` with an adapter that writes structured JSON and preserves these fields.
