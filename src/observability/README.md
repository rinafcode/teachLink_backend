# Advanced Logging and Observability System

Comprehensive observability solution with structured logging, distributed tracing, metrics collection, and automated anomaly detection.

## Features

- **Structured Logging**: JSON-formatted logs with correlation IDs and context
- **Distributed Tracing**: OpenTelemetry-based tracing across all services
- **Metrics Collection**: Custom business and performance metrics
- **Log Aggregation**: Centralized log storage and search
- **Anomaly Detection**: Automated detection of unusual patterns
- **Real-Time Monitoring**: Live dashboards and alerts

## Architecture

```
src/observability/
├── observability.module.ts              # Main module
├── observability.service.ts             # Central service
├── observability.controller.ts          # REST API
├── interfaces/
│   └── observability.interfaces.ts      # TypeScript interfaces
├── logging/
│   ├── structured-logger.service.ts     # Structured logging
│   └── log-aggregation.service.ts       # Log storage & search
├── tracing/
│   └── distributed-tracing.service.ts   # OpenTelemetry tracing
├── metrics/
│   └── metrics-analysis.service.ts      # Metrics collection
└── anomaly/
    └── anomaly-detection.service.ts     # Anomaly detection
```

## Quick Start

### 1. Structured Logging

```typescript
import { StructuredLoggerService } from './observability/logging/structured-logger.service';

@Injectable()
export class MyService {
  constructor(private readonly logger: StructuredLoggerService) {}

  async doSomething() {
    // Set context
    this.logger.setCorrelationId('req-123');
    this.logger.setUserId('user-456');

    // Log messages
    this.logger.log('Operation started');
    this.logger.debug('Debug information', { key: 'value' });
    this.logger.warn('Warning message');
    this.logger.error('Error occurred', new Error('Something went wrong'));

    // Log with timing
    const startTime = new Date();
    // ... do work ...
    this.logger.logWithTiming('info', 'Operation completed', startTime);
  }
}
```

### 2. Distributed Tracing

```typescript
import { DistributedTracingService } from './observability/tracing/distributed-tracing.service';

@Injectable()
export class MyService {
  constructor(private readonly tracing: DistributedTracingService) {}

  async processRequest() {
    // Execute within a span
    return this.tracing.executeInSpan(
      'process-request',
      async (span) => {
        // Add attributes
        this.tracing.setSpanAttributes(span, {
          userId: 'user-123',
          operation: 'process',
        });

        // Add events
        this.tracing.addSpanEvent(span, 'validation-complete');

        // Do work
        const result = await this.doWork();

        return result;
      },
      { 'service.name': 'my-service' },
    );
  }

  async traceHttpCall() {
    return this.tracing.traceHttpRequest(
      'POST',
      '/api/users',
      async (span) => {
        // Make HTTP call
        return await this.httpClient.post('/api/users', data);
      },
    );
  }
}
```

### 3. Metrics Collection

```typescript
import { MetricsAnalysisService } from './observability/metrics/metrics-analysis.service';

@Injectable()
export class MyService {
  constructor(private readonly metrics: MetricsAnalysisService) {}

  async trackBusinessMetrics() {
    // Track user signup
    this.metrics.trackUserSignup('user-123', 'google');

    // Track payment
    this.metrics.trackPayment(99.99, 'USD');

    // Track course enrollment
    this.metrics.trackCourseEnrollment('course-456', 'user-123');

    // Custom counter
    this.metrics.incrementCounter('custom.event', 1, { type: 'important' });

    // Custom gauge
    this.metrics.recordGauge('queue.size', 150);

    // Custom histogram
    this.metrics.recordHistogram('request.duration', 250);
  }
}
```

### 4. Anomaly Detection

```typescript
import { AnomalyDetectionService } from './observability/anomaly/anomaly-detection.service';

@Injectable()
export class MyService {
  constructor(private readonly anomalyDetection: AnomalyDetectionService) {}

  async checkForAnomalies() {
    // Detect anomalies in a metric
    const anomalies = this.anomalyDetection.detectAnomalies(
      'api.response_time',
      100,
    );

    if (anomalies.length > 0) {
      console.log('Anomalies detected:', anomalies);
    }

    // Check system health
    const health = this.anomalyDetection.getSystemHealth();
    console.log('System health:', health.status);
  }
}
```

## API Endpoints

### Dashboard

```http
GET /observability/dashboard
```

Response:
```json
{
  "logs": {
    "total": 15420,
    "byLevel": {
      "debug": 5000,
      "info": 8000,
      "warn": 2000,
      "error": 400,
      "fatal": 20
    },
    "errorRate": 2.73
  },
  "traces": {
    "total": 3500,
    "completed": 3450,
    "active": 50,
    "avgDuration": 125.5
  },
  "health": {
    "status": "healthy",
    "issues": []
  }
}
```

### Search Logs

```http
POST /observability/logs/search
Content-Type: application/json

{
  "level": "error",
  "startTime": "2024-01-01T00:00:00Z",
  "endTime": "2024-01-31T23:59:59Z",
  "search": "database",
  "limit": 50
}
```

### Get Trace

```http
GET /observability/traces/:traceId
```

### Get Metrics

```http
GET /observability/metrics/api.response_time?limit=100
```

### Get Metric Statistics

```http
GET /observability/metrics/api.response_time/statistics
```

Response:
```json
{
  "name": "api.response_time",
  "count": 1000,
  "avg": 125.5,
  "min": 10,
  "max": 5000,
  "p50": 100,
  "p95": 500,
  "p99": 1000,
  "stdDev": 150.2
}
```

### Get Anomalies

```http
GET /observability/anomalies?limit=50
```

### Detect Anomalies

```http
POST /observability/anomalies/detect
Content-Type: application/json

{
  "metricName": "api.response_time",
  "windowSize": 100
}
```

### System Health

```http
GET /observability/health
```

Response:
```json
{
  "status": "healthy",
  "issues": []
}
```

## Correlation IDs

Correlation IDs allow you to trace a request across all services and logs:

```typescript
// In middleware or interceptor
const correlationId = req.headers['x-correlation-id'] || uuidv4();
this.logger.setCorrelationId(correlationId);

// All subsequent logs will include this correlation ID
this.logger.log('Processing request'); // Includes correlationId

// Search logs by correlation ID
const logs = await this.logAggregation.getLogsByCorrelationId(correlationId);
```

## Distributed Tracing

Trace requests across microservices:

```typescript
// Service A
const span = this.tracing.startSpan('service-a-operation');
const headers = this.tracing.injectTraceContext(span);

// Pass headers to Service B
await this.httpClient.post('http://service-b/api', data, { headers });

this.tracing.endSpan(span);

// Service B
const traceContext = this.tracing.extractTraceContext(req.headers);
// Continue the trace...
```

## Metrics Types

### Counter
Monotonically increasing value:
```typescript
this.metrics.incrementCounter('requests.total', 1);
```

### Gauge
Current value that can go up or down:
```typescript
this.metrics.recordGauge('queue.size', 150);
```

### Histogram
Distribution of values:
```typescript
this.metrics.recordHistogram('request.duration', 250);
```

### Summary
Similar to histogram with percentiles:
```typescript
this.metrics.recordSummary('response.size', 1024);
```

## Anomaly Detection Methods

### Statistical (Z-Score)
Detects values beyond 3 standard deviations:
```typescript
const anomalies = this.anomalyDetection.detectAnomalies('metric.name');
```

### Moving Average
Detects deviations from moving average:
```typescript
const anomalies = this.anomalyDetection.detectAnomaliesMovingAverage(
  'metric.name',
  20, // window size
  2,  // threshold
);
```

### Sudden Spikes
Detects sudden changes:
```typescript
const anomaly = this.anomalyDetection.detectSuddenSpike('metric.name', 3);
```

## Integration Examples

### HTTP Interceptor

```typescript
@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  constructor(
    private readonly observability: ObservabilityService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const correlationId = request.headers['x-correlation-id'] || uuidv4();
    const startTime = Date.now();

    // Initialize observability
    this.observability.initializeRequestObservability(
      correlationId,
      request.user?.id,
    );

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const logger = this.observability.getLogger();
        const metrics = this.observability.getMetrics();

        logger.logRequest(
          request.method,
          request.url,
          200,
          duration,
        );

        metrics.trackApiResponseTime(
          request.url,
          duration,
          200,
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const logger = this.observability.getLogger();
        const metrics = this.observability.getMetrics();

        logger.error('Request failed', error);
        metrics.trackApiResponseTime(
          request.url,
          duration,
          500,
        );

        throw error;
      }),
    );
  }
}
```

### Database Query Logging

```typescript
@Injectable()
export class DatabaseLogger implements Logger {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly metrics: MetricsAnalysisService,
  ) {}

  logQuery(query: string, parameters?: any[]) {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      this.logger.logQuery(query, duration);
      this.metrics.trackDatabaseQueryTime(query, duration);
    };
  }
}
```

## Prometheus Integration

Export metrics in Prometheus format:

```http
GET /observability/metrics/export/prometheus
```

Response:
```
# TYPE api_response_time histogram
api_response_time{endpoint="/api/users",status="200"} 125.5
# TYPE user_signups counter
user_signups{source="google"} 150
```

## Best Practices

1. **Always use correlation IDs** for request tracking
2. **Set appropriate log levels** (debug in dev, info+ in prod)
3. **Add context to logs** with metadata
4. **Use spans for long operations** to track performance
5. **Track business metrics** not just technical ones
6. **Set up alerts** for anomalies
7. **Clean up old data** regularly
8. **Use tags** for metric filtering
9. **Monitor system health** continuously
10. **Export to external systems** in production

## Production Setup

### External Log Aggregation

Integrate with Elasticsearch, CloudWatch, or Datadog:

```typescript
// In log-aggregation.service.ts
private async sendToExternalService(log: StructuredLog): Promise<void> {
  // Elasticsearch
  await this.elasticsearchClient.index({
    index: 'logs',
    body: log,
  });

  // CloudWatch
  await this.cloudWatchClient.putLogEvents({
    logGroupName: 'teachlink',
    logStreamName: 'application',
    logEvents: [{
      message: JSON.stringify(log),
      timestamp: log.context.timestamp.getTime(),
    }],
  });
}
```

### Alerting

Set up alerts for critical issues:

```typescript
private async sendAlert(anomaly: AnomalyDetectionResult): Promise<void> {
  // PagerDuty
  await this.pagerDutyClient.trigger({
    routing_key: process.env.PAGERDUTY_KEY,
    event_action: 'trigger',
    payload: {
      summary: anomaly.details,
      severity: 'error',
      source: 'observability',
    },
  });

  // Slack
  await this.slackClient.chat.postMessage({
    channel: '#alerts',
    text: `🚨 Anomaly detected: ${anomaly.details}`,
  });
}
```

## Troubleshooting

### High Memory Usage

Check metrics and clean old data:
```typescript
await this.logAggregation.clearOldLogs(new Date(Date.now() - 24 * 60 * 60 * 1000));
await this.tracing.clearOldSpans(new Date(Date.now() - 24 * 60 * 60 * 1000));
await this.metrics.clearOldMetrics(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
```

### Missing Traces

Ensure spans are properly closed:
```typescript
const span = this.tracing.startSpan('operation');
try {
  // Do work
} finally {
  this.tracing.endSpan(span); // Always close spans
}
```

### Anomaly False Positives

Adjust thresholds:
```typescript
// In anomaly-detection.service.ts
private readonly thresholds = {
  errorRate: 10, // Increase from 5 to 10
  responseTime: 10000, // Increase from 5000 to 10000
};
```

## Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Structured Logging Best Practices](https://www.loggly.com/ultimate-guide/node-logging-basics/)
- [Distributed Tracing Guide](https://opentelemetry.io/docs/concepts/observability-primer/#distributed-tracing)
- [Anomaly Detection Algorithms](https://en.wikipedia.org/wiki/Anomaly_detection)
