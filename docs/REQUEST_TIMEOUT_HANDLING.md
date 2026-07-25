# Request Timeout Handling

## Overview

This document describes the request timeout handling system implemented for the TeachLink API. Timeouts prevent indefinite hanging of HTTP requests and ensure proper resource management.

## Configuration

### Default Timeout

The default request timeout is set to **30 seconds (30000ms)** globally for all endpoints. This can be found in:
- [src/common/interceptors/request-timeout.interceptor.ts](../../src/common/interceptors/request-timeout.interceptor.ts#L17)

### Per-Endpoint Configuration

To override the default timeout for a specific endpoint, use the `@UseRequestTimeout()` decorator:

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { UseRequestTimeout } from '../common/decorators/request-timeout.decorator';

@Controller('data')
export class DataController {
  // Use 5-second timeout for this endpoint
  @UseRequestTimeout(5000)
  @Get(':id')
  getData(@Param('id') id: string) {
    // Implementation
  }

  // Uses default 30-second timeout
  @Get()
  getAllData() {
    // Implementation
  }
}
```

## Timeout Error Response

When a request exceeds the configured timeout, a `504 Gateway Timeout` response is returned:

```json
{
  "message": "Request timeout after 30000ms",
  "error": "Request Timeout",
  "statusCode": 504,
  "correlationId": "unique-correlation-id",
  "timeout": 30000
}
```

## Monitoring

Timeout events are monitored through Prometheus metrics:

### Metrics

- **http_request_timeouts_total**: Counter metric tracking total number of request timeouts
  - Labels: `route` (HTTP method + path)

### Example Prometheus Query

```promql
# Get timeout rate per route (over last 5 minutes)
rate(http_request_timeouts_total[5m]) by (route)

# Get total timeouts for a specific route
http_request_timeouts_total{route="GET /api/data/:id"}

# Alert on high timeout rate
rate(http_request_timeouts_total[5m]) > 0.1
```

## Implementation Details

### Interceptor Behavior

The timeout interceptor (`RequestTimeoutInterceptor`):

1. **Reads configuration**: Checks for `@UseRequestTimeout()` decorator on the handler
2. **Sets timeout**: Uses decorator value or falls back to 30s default
3. **Monitors execution**: Wraps the observable with RxJS `timeout()` operator
4. **Handles timeout**: 
   - Increments timeout counter metric
   - Records request duration metric
   - Returns 504 error response with correlation ID
5. **Preserves errors**: Re-throws non-timeout errors without modification

### Metrics Recording

When a timeout occurs:
- `http_request_timeouts_total` counter incremented for the route
- `http_request_duration_seconds` histogram records the elapsed time with 504 status

## Best Practices

1. **Set appropriate timeouts**: Consider operation complexity and expected duration
   - Read operations: 5-15 seconds
   - Write operations: 10-20 seconds
   - Long-running operations: 30-60 seconds (or use async workers)

2. **Use async workers for long operations**: For operations expected to take > 30s, use the async worker queue system instead of HTTP requests

3. **Monitor timeout metrics**: Set up alerts for high timeout rates indicating performance issues

4. **Correlation IDs**: Each timeout includes a correlation ID for easy log tracing

## Example: Custom Timeout for Search Operation

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { UseRequestTimeout } from '../common/decorators/request-timeout.decorator';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // Search can take up to 15 seconds
  @UseRequestTimeout(15000)
  @Get()
  async search(@Query('q') query: string) {
    return this.searchService.performSearch(query);
  }
}
```

## Testing

To test timeout behavior:

```bash
# Start the application
npm start

# Test with curl (will wait 35 seconds for a timeout)
curl -X GET "http://localhost:3000/api/data/1" --max-time 40

# Test with a custom timeout endpoint
@UseRequestTimeout(2000) // 2 second timeout
@Get('slow')
slowEndpoint() {
  // Endpoint that takes 5 seconds will timeout
}
```

## Integration with Other Systems

- **Metrics**: Timeouts are tracked in Prometheus and available at `/metrics`
- **Logging**: Each timeout request includes correlation ID for distributed tracing
- **Error Handling**: Global exception filter handles timeout responses consistently
