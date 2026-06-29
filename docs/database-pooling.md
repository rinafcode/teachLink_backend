# Database Connection Pooling and Observability

This document details the configuration, monitoring, query timeout controls, slow query detection, connection leak detection, and troubleshooting strategies for the database connection pool in the TeachLink backend.

---

## 1. Pool Configuration

The connection pool is dynamically configured through the environment variables described below. If these variables are not set, safe defaults are automatically applied.

### Environment Variables

| Variable | Description | Default Value | Recommendation |
| :--- | :--- | :--- | :--- |
| `DATABASE_POOL_MAX` | Maximum number of concurrent connections in the pool. | `30` | Sized based on DB host capacity. E.g., `50-100` for production. |
| `DATABASE_POOL_MIN` | Minimum number of idle connections to keep open. | `5` | `5-10` to avoid connection spike latency during cold starts. |
| `DATABASE_POOL_ACQUIRE_TIMEOUT_MS` | Maximum duration (ms) to wait for a free connection before throwing an error. | `10000` (10s) | Keep at `5000`–`10000` to fail fast and prevent thread starvation. |
| `DATABASE_POOL_IDLE_TIMEOUT_MS` | Time (ms) after which an idle connection is closed. | `30000` (30s) | Keep at `30000`–`60000` to clean up unused connections. |
| `DATABASE_POOL_MAX_LIFETIME_SEC` | Maximum lifetime (seconds) of a connection before it is rotated. | `1800` (30m) | `1800`–`3600` to rotate connections and avoid connection memory leaks. |
| `DATABASE_POOL_QUERY_TIMEOUT_MS` | Default timeout (ms) for any database statement execution. | `30000` (30s) | Sized according to response SLA. Lower in API gateways (e.g. `10000`). |
| `DATABASE_POOL_LEAK_THRESHOLD_MS` | Threshold (ms) after which a checked-out connection is warned as a leak. | `60000` (60s) | Match execution profiles. Default of `60000` is safe. |
| `DATABASE_POOL_SLOW_QUERY_THRESHOLD_MS` | Threshold (ms) above which queries are logged as warnings and tracked. | `1000` (1s) | `1000` (1s) for general queries; lower (e.g. `200`–`500` ms) for high-thru SLAs. |

---

## 2. Observability & Prometheus Metrics

The connection pool automatically publishes metrics to the centralized Prometheus registry via the `/metrics` endpoint. 

### Metrics Reference

| Metric Name | Type | Description |
| :--- | :--- | :--- |
| `db_pool_size` | Gauge | Current size of the connection pool (active + idle connections). |
| `db_active_connections` | Gauge | Number of connections currently checked out and in use. |
| `db_pool_idle_connections` | Gauge | Number of idle connections ready for immediate checkout. |
| `db_pool_pending_requests` | Gauge | Number of queries currently queued waiting for a free connection slot. |
| `db_pool_connections_acquired_total` | Counter | Total number of connection acquisitions since startup. |
| `db_pool_connections_released_total` | Counter | Total number of connection releases since startup. |
| `db_pool_waits_total` | Counter | Total number of checkouts that had to wait for a connection slot. |
| `db_pool_wait_duration_seconds` | Histogram | Time spent waiting to acquire a connection from the pool. |
| `db_pool_max_idle_closed_total` | Counter | Number of connections closed because they exceeded the idle timeout. |
| `db_pool_max_lifetime_closed_total` | Counter | Number of connections closed/rotated due to exceeding maximum age. |
| `db_slow_queries_total` | Counter | Number of database queries that exceeded the slow query threshold. |

---

## 3. Query Timeouts

Queries are protected at the database driver level using the native PostgreSQL `statement_timeout` configuration. If a query runs longer than `DATABASE_POOL_QUERY_TIMEOUT_MS` (default 30 seconds), the database server aborts the execution and returns a cancellation error back to the application. 

This ensures that:
- Long-running or poorly written queries do not monopolize database connection slots.
- Connection leak risks due to hanging queries are minimized.

---

## 4. Slow Query Detection

Every query execution is monitored by the `DbMetricsSubscriber` using high-resolution timers. If execution time meets or exceeds `DATABASE_POOL_SLOW_QUERY_THRESHOLD_MS` (default 1 second):
- A warning log is printed via the NestJS structured logger.
- The warning contains the exact SQL query, execution parameters, actual duration, operation name, and the active **Request Correlation ID** (from `AsyncLocalStorage`) to trace it back to the specific client request.
- The `db_slow_queries_total` counter is incremented, segmented by `query_type` and `table` labels.

### Example Log Output
```json
{
  "timestamp": "2026-06-24T14:15:30.123Z",
  "level": "warn",
  "service": "teachlink-backend",
  "message": "Slow query detected: operation=\"SELECT courses\" duration=1.234s (threshold=1.000s) [Request ID: cid-j1s8zk-82jsdf82]",
  "meta": {
    "query": "SELECT * FROM \"courses\" WHERE \"instructorId\" = $1",
    "parameters": [45],
    "durationSeconds": 1.234,
    "operationName": "SELECT courses",
    "correlationId": "cid-j1s8zk-82jsdf82"
  }
}
```

---

## 5. Connection Leak Detection

Connection leaks occur when the application checks out a connection from the pool but fails to release it (e.g., missing `finally` blocks or hanging promises).

`PoolLeakDetectorService` automatically monitors all checkouts:
1. **Zero-Overhead Event Hooks**: Uses the driver's `'acquire'`, `'release'`, and `'remove'` events to track active checkouts reactively.
2. **Periodic Scan**: Runs a background scanner every 30 seconds.
3. **Detection**: If a connection is held longer than `DATABASE_POOL_LEAK_THRESHOLD_MS` (default 60 seconds), it prints a warning log containing the duration and the **precise stack trace** from when the checkout occurred, helping developers locate the leaked code path.

---

## 6. Troubleshooting Connection Exhaustion

If the application experiences connection starvation (errors such as `timeout executing query` or `Too many connections`):

### Diagnostic Steps

1. **Check Pending Requests Count**:
   Inspect the Prometheus metric `db_pool_pending_requests`. If this value is consistently greater than zero, the database is saturated or the pool size is too small.
2. **Check Wait Duration**:
   Plot the histogram `db_pool_wait_duration_seconds`. High checkout wait times indicate that threads are blocked waiting for connections.
3. **Locate Leaks**:
   Search logs for `"Potential connection leak detected"`. The stack trace in the warning log will point directly to the function that checked out the connection but did not release it.
4. **Identify Slow Queries**:
   Analyze the `db_slow_queries_total` metric and filter logs for slow query warnings. Optimizing indexes or refactoring slow SELECTs will return connections to the pool faster.

### Production Tuning Recommendations

1. **Sizing Formula**:
   $$\text{Max Pool Size} \approx \frac{(\text{DB CPU Cores} \times 2) + \text{Spindle Count}}{\text{Backend Replica Count}}$$
2. **Idle Connections**:
   Ensure `DATABASE_POOL_MIN` is kept above `5` to prevent connection churn latency during sudden traffic spikes.
3. **Max Lifetime**:
   Keep `DATABASE_POOL_MAX_LIFETIME_SEC` at `1800` (30 minutes) to clean up stale resources or database-side memory overhead, but stagger this duration if running a large cluster to avoid mass simultaneous connection closures.
