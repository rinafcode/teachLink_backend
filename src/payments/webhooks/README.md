# Webhook Retry Implementation

This document describes the webhook retry mechanism with exponential backoff and dead letter handling for the TeachLink backend payments module.

## Overview

The webhook retry system provides robust handling of webhook deliveries from payment providers (Stripe, PayPal) with the following features:

- **Automatic Retries**: Failed webhooks are automatically retried
- **Exponential Backoff**: Retry delays increase exponentially to reduce server load
- **Dead Letter Queue**: Webhooks that fail after max retries are moved to a dead letter queue for manual inspection
- **Idempotency**: Prevents duplicate processing of the same webhook event
- **Async Processing**: Webhooks are processed asynchronously using Bull queues for better performance

## Architecture

### Components

1. **WebhookRetry Entity** (`webhook-retry.entity.ts`)
   - Stores webhook delivery attempts and status
   - Tracks retry count, last error, and next retry time
   - Supports both Stripe and PayPal webhooks

2. **WebhookRetryProcessor** (`webhook-retry.processor.ts`)
   - Bull job processor that handles webhook processing
   - Implements exponential backoff logic
   - Handles errors and moves failed webhooks to dead letter queue

3. **WebhookQueueService** (`webhook-queue.service.ts`)
   - Enqueues webhooks for processing
   - Manages webhook status and retrieval
   - Provides methods to requeue dead letter webhooks

4. **WebhookService** (`webhook.service.ts`)
   - Updated to use queue-based processing
   - Verifies webhook signatures before queuing
   - Returns webhook retry ID to the caller

5. **WebhookManagementController** (`webhook-management.controller.ts`)
   - Provides REST API endpoints for webhook management
   - Allows inspection and requeuing of failed webhooks

## Database Schema

The `webhook_retries` table stores all webhook delivery attempts:

```sql
CREATE TABLE webhook_retries (
  id UUID PRIMARY KEY,
  provider ENUM('stripe', 'paypal'),
  externalEventId VARCHAR,
  status ENUM('pending', 'processing', 'succeeded', 'failed', 'dead_letter'),
  payload JSONB,
  signature TEXT,
  retryCount INT DEFAULT 0,
  maxRetries INT DEFAULT 3,
  nextRetryTime TIMESTAMP,
  lastError TEXT,
  errorDetails JSONB,
  headers JSONB,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  processedAt TIMESTAMP
);

CREATE UNIQUE INDEX idx_webhook_provider_event 
  ON webhook_retries(provider, externalEventId);
  
CREATE INDEX idx_webhook_status_retry 
  ON webhook_retries(status, nextRetryTime);
  
CREATE INDEX idx_webhook_created 
  ON webhook_retries(createdAt);
```

## Retry Logic

### Exponential Backoff Algorithm

```
delay = initialDelay * (backoffMultiplier ^ retryCount) + jitter
where:
  initialDelay = 1000ms (1 second)
  backoffMultiplier = 2
  maxDelay = 3600000ms (1 hour)
  jitter = random(0, 0.1 * delay)
```

### Example Retry Timeline

For a webhook that fails immediately:

1. **Attempt 1**: Immediate (timestamp: T)
2. **Retry 1**: T + 1s (± jitter)
3. **Retry 2**: T + 3s (± jitter)
4. **Retry 3**: T + 7s (± jitter)
5. **Dead Letter**: After 3 retries, moved to dead letter queue

## API Endpoints

### Webhook Processing

#### POST /webhooks/stripe
Receives and queues Stripe webhook events.

**Request Headers:**
- `stripe-signature`: Webhook signature for verification

**Response:**
```json
{
  "received": true,
  "webhookRetryId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### POST /webhooks/paypal
Receives and queues PayPal webhook events.

**Request Headers:**
- `paypal-transmission-id`: Transmission ID
- `paypal-transmission-time`: Transmission time
- `paypal-transmission-sig`: Transmission signature
- `paypal-cert-url`: Certificate URL
- `paypal-auth-algo`: Authentication algorithm

### Webhook Management

#### GET /webhooks/status/:id
Get the current status of a webhook.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "stripe",
  "externalEventId": "evt_123",
  "status": "pending",
  "retryCount": 0,
  "maxRetries": 3,
  "nextRetryTime": "2026-04-23T10:00:00Z",
  "lastError": null,
  "createdAt": "2026-04-23T09:59:00Z"
}
```

#### GET /webhooks/dead-letter?limit=100
Get dead letter webhooks.

**Query Parameters:**
- `limit` (optional, default: 100): Maximum number of results

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "provider": "stripe",
    "externalEventId": "evt_123",
    "status": "dead_letter",
    "retryCount": 3,
    "lastError": "Network timeout",
    "errorDetails": {
      "stack": "Error: Network timeout...",
      "timestamp": "2026-04-23T10:05:00Z"
    }
  }
]
```

#### GET /webhooks/pending?limit=100
Get pending webhooks awaiting processing.

#### GET /webhooks/processing
Get currently processing webhooks.

#### POST /webhooks/requeue/:id
Requeue a dead letter webhook for reprocessing.

**Response:**
```json
{
  "success": true
}
```

## Error Handling

### Types of Errors

1. **Signature Verification Errors**: Webhook is rejected without retry
2. **Network Errors**: Webhook is retried with exponential backoff
3. **Processing Errors**: Webhook is retried with exponential backoff
4. **Exhausted Retries**: Webhook is moved to dead letter queue

### Error Details

Each failed webhook stores:
- `lastError`: Human-readable error message
- `errorDetails`: Additional error context (stack trace, timestamp)
- `retryCount`: Number of retry attempts made
- `nextRetryTime`: When the next retry is scheduled

## Configuration

Default configuration (in `WebhookRetryProcessor`):

```typescript
private readonly initialDelayMs = 1000;      // 1 second
private readonly maxDelayMs = 3600000;       // 1 hour
private readonly backoffMultiplier = 2;
```

To customize these values, modify the `WebhookRetryProcessor` class constants.

## Monitoring

### Key Metrics to Monitor

1. **Webhook Success Rate**: Percentage of webhooks processed successfully
2. **Retry Rate**: Percentage of webhooks that required retries
3. **Dead Letter Count**: Number of webhooks in dead letter queue
4. **Processing Time**: Average time to process a webhook
5. **Queue Depth**: Number of pending webhooks

### Alerts to Set

- Dead letter queue size > 100
- Retry rate > 10%
- Webhook processing time > 5 seconds
- Webhook processing failure rate > 1%

## Usage Examples

### Processing a Webhook

```typescript
// Stripe webhook endpoint automatically queues the webhook
// Client receives confirmation with webhookRetryId
POST /webhooks/stripe
Headers: {
  "stripe-signature": "t=...,v1=..."
}
Body: <raw webhook payload>

// Response
{
  "received": true,
  "webhookRetryId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Checking Webhook Status

```typescript
// Check if webhook was processed successfully
GET /webhooks/status/550e8400-e29b-41d4-a716-446655440000

// Response
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "succeeded",
  "processedAt": "2026-04-23T10:00:05Z"
}
```

### Requeuing a Dead Letter Webhook

```typescript
// Find dead letter webhooks
GET /webhooks/dead-letter

// Requeue a specific dead letter webhook
POST /webhooks/requeue/550e8400-e29b-41d4-a716-446655440000

// Response
{
  "success": true
}
```

## Testing

Run the webhook retry tests:

```bash
# Run webhook queue service tests
npm test -- webhook-queue.service.spec

# Run webhook retry processor tests
npm test -- webhook-retry.processor.spec

# Run all webhook tests
npm test -- webhooks
```

## Future Enhancements

1. **Webhook Event Deduplication**: Prevent processing of duplicate events
2. **Webhook Signature Validation**: Enhanced validation for PayPal webhooks
3. **Dead Letter Processing**: Automated or manual handling strategies
4. **Metrics Integration**: Send retry metrics to monitoring service
5. **Circuit Breaker Pattern**: Pause webhook processing if payment service is down
6. **Webhook Replay**: Ability to replay processed webhooks for audit trail

## Troubleshooting

### Webhooks Not Being Processed

1. Check if webhook queue is running: `redis-cli INFO`
2. Verify webhook status: `GET /webhooks/status/<id>`
3. Check application logs for errors
4. Ensure database connection is active

### High Dead Letter Queue

1. Review `lastError` and `errorDetails` in dead letter webhooks
2. Check payment provider API status
3. Verify webhook signatures are correct
4. Review application error logs

### Memory Issues

If experiencing high memory usage:

1. Reduce the number of concurrent job processors
2. Implement job cleanup to remove old completed webhooks
3. Monitor Redis memory usage

## Integration with Payment Providers

### Stripe

- Webhook events are verified using Stripe's signature
- Supported events:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `charge.refunded`
  - `customer.subscription.*`

### PayPal

- Webhook events are authenticated using PayPal's transmission signature
- Supported events:
  - `PAYMENT.SALE.COMPLETED`
  - `PAYMENT.SALE.REFUNDED`

## References

- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [PayPal Webhooks](https://developer.paypal.com/docs/platforms/webhooks/)
- [Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
