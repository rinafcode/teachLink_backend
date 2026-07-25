# Graceful Shutdown Implementation

This document describes the comprehensive graceful shutdown system implemented to prevent data loss and ensure clean application termination.

## Overview

The graceful shutdown system orchestrates the orderly shutdown of all application components in the correct sequence, ensuring:

- ✅ **Shutdown hook implementation** - Signal handlers and orchestrated shutdown phases
- ✅ **In-flight request completion** - Request tracking and completion waiting
- ✅ **Database connection cleanup** - Pool draining and connection management
- ✅ **Queue job completion/requeue** - Worker coordination and job handling

## Architecture

### Core Components

1. **GracefulShutdownService** - Main orchestrator that manages shutdown phases
2. **RequestTrackerService** - Tracks active HTTP requests
3. **DatabaseShutdownService** - Manages database connection cleanup
4. **WorkerShutdownService** - Handles worker pool and job queue shutdown
5. **ShutdownStateService** - Maintains application shutdown state
6. **ShutdownHealthController** - Provides health check endpoints

### Shutdown Phases

The shutdown process executes in the following phases:

```
1. Stop Accepting Requests (5s timeout)
   └── Mark application as shutting down
   └── Stop accepting new HTTP requests

2. Complete Active Requests (15s timeout)
   └── Wait for in-flight requests to complete
   └── Track request completion status

3. Shutdown Workers (20s timeout)
   └── Pause job queues
   └── Wait for active jobs to complete
   └── Requeue incomplete jobs
   └── Terminate worker processes

4. Shutdown Database (15s timeout)
   └── Drain connection pool
   └── Wait for active queries
   └── Close all connections

5. Close Application (5s timeout)
   └── Close NestJS application
   └── Final cleanup
```

## Implementation Details

### 1. Shutdown Hook Implementation

**File**: `src/common/services/graceful-shutdown.service.ts`

The `GracefulShutdownService` provides:
- Phase registration and execution
- Timeout management per phase
- Error handling and recovery
- Global shutdown timeout with force exit

```typescript
// Register shutdown phases in main.ts
gracefulShutdown.registerShutdownPhase({
  name: 'stop-accepting-requests',
  timeout: 5000,
  execute: async () => {
    shutdownState.markShuttingDown('Graceful shutdown initiated');
  },
});
```

**Signal Handlers**: SIGTERM and SIGINT are handled in `src/main.ts`:

```typescript
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### 2. In-Flight Request Completion

**File**: `src/common/services/request-tracker.service.ts`

The `RequestTrackerService` provides:
- Express middleware for request tracking
- Active request counting and monitoring
- Request completion waiting with timeout
- Detailed request information logging

```typescript
// Middleware tracks all incoming requests
app.use(requestTracker.trackRequest());

// Wait for requests to complete during shutdown
await requestTracker.waitForActiveRequests(timeoutMs);
```

**Features**:
- Unique request ID generation
- Request duration tracking
- Correlation ID support
- Automatic cleanup on response completion

### 3. Database Connection Cleanup

**File**: `src/database/services/database-shutdown.service.ts`

The `DatabaseShutdownService` provides:
- Connection pool draining
- Active query monitoring
- Graceful connection closure
- Force close fallback

**Shutdown Process**:
1. **Drain Phase**: Wait for connections to return to pool
2. **Query Wait**: Monitor active queries until completion
3. **Close Phase**: Gracefully close all connections
4. **Force Close**: Emergency fallback if graceful close fails

```typescript
// Environment configuration
DB_DRAIN_TIMEOUT_MS=15000
DB_FORCE_CLOSE_TIMEOUT_MS=5000
DB_WAIT_FOR_QUERIES=true
DB_LOG_SHUTDOWN_DETAILS=true
```

### 4. Queue Job Completion/Requeue

**File**: `src/workers/services/worker-shutdown.service.ts`

The `WorkerShutdownService` provides:
- Worker pool management
- Job completion monitoring
- Incomplete job requeuing
- Worker process termination

**Shutdown Process**:
1. **Pause Queues**: Stop accepting new jobs
2. **Job Completion**: Wait for active jobs to finish
3. **Requeue**: Move incomplete jobs back to queue
4. **Terminate**: Gracefully stop worker processes

```typescript
// Environment configuration
WORKER_GRACEFUL_TIMEOUT_MS=20000
WORKER_JOB_TIMEOUT_MS=15000
WORKER_FORCE_TIMEOUT_MS=5000
WORKER_REQUEUE_JOBS=true
WORKER_WAIT_COMPLETION=true
```

## Health Check Endpoints

### Shutdown Status
```
GET /health/shutdown
```

Returns comprehensive shutdown status:
```json
{
  "status": "healthy|shutting_down|unhealthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "shutdown": {
    "isShuttingDown": false,
    "startTime": null,
    "reason": null,
    "durationMs": null
  },
  "requests": {
    "activeCount": 0,
    "longestRunningMs": 0
  },
  "database": {
    "isShuttingDown": false,
    "poolUtilization": 25
  },
  "workers": {
    "isShuttingDown": false,
    "phase": "idle",
    "activeJobs": 0,
    "totalWorkers": 6
  },
  "readiness": {
    "acceptingRequests": true,
    "acceptingJobs": true,
    "databaseReady": true
  }
}
```

### Readiness Check
```
GET /health/shutdown/readiness
```

Load balancer-friendly readiness check:
```json
{
  "ready": true,
  "activeRequests": 0,
  "activeJobs": 0
}
```

### Detailed Status
```
GET /health/shutdown/detailed
```

Comprehensive debugging information including active requests, worker details, and database status.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SHUTDOWN_TIMEOUT_MS` | 30000 | Global shutdown timeout |
| `FORCE_EXIT_ON_TIMEOUT` | true | Force exit if timeout exceeded |
| `DB_DRAIN_TIMEOUT_MS` | 15000 | Database connection drain timeout |
| `DB_FORCE_CLOSE_TIMEOUT_MS` | 5000 | Database force close timeout |
| `DB_WAIT_FOR_QUERIES` | true | Wait for active queries to complete |
| `DB_LOG_SHUTDOWN_DETAILS` | false | Log detailed database shutdown info |
| `WORKER_GRACEFUL_TIMEOUT_MS` | 20000 | Worker graceful shutdown timeout |
| `WORKER_JOB_TIMEOUT_MS` | 15000 | Job completion timeout |
| `WORKER_FORCE_TIMEOUT_MS` | 5000 | Worker force termination timeout |
| `WORKER_REQUEUE_JOBS` | true | Requeue incomplete jobs |
| `WORKER_WAIT_COMPLETION` | true | Wait for job completion |

### Cluster Mode Support

The implementation supports cluster mode with coordinated shutdown:
- Primary process manages worker shutdown
- Workers report shutdown status to primary
- Graceful termination with timeout handling

## Usage Examples

### Basic Shutdown
```bash
# Send SIGTERM for graceful shutdown
kill -TERM <pid>

# Send SIGINT (Ctrl+C)
kill -INT <pid>
```

### Monitoring Shutdown
```bash
# Check shutdown status
curl http://localhost:3000/health/shutdown

# Check readiness (for load balancers)
curl http://localhost:3000/health/shutdown/readiness

# Get detailed status
curl http://localhost:3000/health/shutdown/detailed
```

### Docker Integration
```dockerfile
# Dockerfile
STOPSIGNAL SIGTERM
# Docker will send SIGTERM and wait for graceful shutdown
```

```yaml
# docker-compose.yml
services:
  app:
    stop_grace_period: 45s  # Allow time for graceful shutdown
```

### Kubernetes Integration
```yaml
# deployment.yaml
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 45
      containers:
      - name: app
        lifecycle:
          preStop:
            httpGet:
              path: /health/shutdown/readiness
              port: 3000
```

## Testing

### Integration Tests
Run the comprehensive test suite:
```bash
npm test src/health/tests/graceful-shutdown.integration.test.ts
```

### Manual Testing
1. Start the application
2. Generate some load (requests, jobs)
3. Send SIGTERM signal
4. Monitor shutdown progress via health endpoints
5. Verify clean shutdown completion

### Load Testing Shutdown
```bash
# Generate load while testing shutdown
ab -n 1000 -c 10 http://localhost:3000/api/health &
kill -TERM $(pgrep node)
```

## Monitoring and Observability

### Metrics
- Active request count
- Request completion time
- Database connection utilization
- Worker job completion rate
- Shutdown phase duration

### Logging
- Shutdown initiation and completion
- Phase execution timing
- Error conditions and recovery
- Resource cleanup status

### Alerts
- Shutdown timeout exceeded
- High active request count during shutdown
- Database connection leaks
- Worker job failures during shutdown

## Best Practices

1. **Graceful Degradation**: Continue shutdown even if individual phases fail
2. **Timeout Management**: Set appropriate timeouts for each phase
3. **Resource Cleanup**: Ensure all resources are properly released
4. **Monitoring**: Use health endpoints for shutdown visibility
5. **Testing**: Regularly test shutdown scenarios under load
6. **Documentation**: Keep shutdown procedures documented for operations

## Troubleshooting

### Common Issues

1. **Shutdown Timeout**
   - Check active request/job counts
   - Review phase timeout configuration
   - Monitor resource utilization

2. **Database Connection Leaks**
   - Enable detailed logging
   - Check connection pool configuration
   - Monitor active query count

3. **Worker Job Failures**
   - Review job requeue logic
   - Check worker termination timeout
   - Monitor job completion rates

### Debug Commands
```bash
# Check active connections
curl http://localhost:3000/health/shutdown/detailed | jq '.database'

# Monitor active requests
curl http://localhost:3000/health/shutdown/detailed | jq '.requests'

# Check worker status
curl http://localhost:3000/health/shutdown/detailed | jq '.workers'
```

## Future Enhancements

1. **Metrics Integration**: Prometheus metrics for shutdown monitoring
2. **Circuit Breaker**: Automatic shutdown on critical errors
3. **Rolling Shutdown**: Coordinated shutdown in multi-instance deployments
4. **Custom Hooks**: Plugin system for custom shutdown logic
5. **Shutdown Scheduling**: Planned maintenance shutdown scheduling