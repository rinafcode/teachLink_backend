# Webhook Retry System - Quick Start Guide

## Quick Overview

The webhook retry system automatically handles failed webhook deliveries from payment providers (Stripe, PayPal) with intelligent retry logic and dead letter queue handling.

## Key Features

✅ **Automatic Retries**: Failed webhooks are retried with exponential backoff
✅ **Exponential Backoff**: Retry delays grow exponentially (1s, 3s, 7s...)
✅ **Dead Letter Queue**: Webhooks that fail after max retries are archived
✅ **Idempotency**: Duplicate events are not processed twice
✅ **Async Processing**: Webhooks processed via job queue for better performance

## Installation

1. **Files are already created** - All necessary files have been added to `src/payments/webhooks/`

2. **Database Migration** - Run this SQL to create the webhook_retries table:
   ```bash
   # Development (TypeORM auto-sync)
   npm run start:dev
   # Table auto-created via TypeORM synchronization
   
   # Production
   # Use the migration SQL from src/payments/webhooks/migration-helper.ts
   ```

3. **Dependencies** - Already in package.json:
   - `@nestjs/bull`: Job queue framework
   - `bull`: Job queue implementation
   - `redis`: Required for job storage

## Usage

### Receiving Webhooks (No Code Changes Needed)

The webhook endpoints automatically use the new retry system:

```bash
# Stripe webhook (existing endpoint - now with retry)
POST /webhooks/stripe
Headers: stripe-signature: <signature>
Body: <raw webhook payload>

# PayPal webhook (existing endpoint - now with retry)
POST /webhooks/paypal
Headers: 
  - paypal-transmission-id: <id>
  - paypal-transmission-time: <time>
  - paypal-transmission-sig: <sig>
  - paypal-cert-url: <url>
  - paypal-auth-algo: <algo>
Body: <webhook payload>
```

### Checking Webhook Status

```bash
# Check if a webhook was processed
curl http://localhost:3000/webhooks/status/{webhookRetryId}

# Response example:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "stripe",
  "externalEventId": "evt_123",
  "status": "succeeded",
  "retryCount": 0,
  "maxRetries": 3,
  "createdAt": "2026-04-23T10:00:00Z",
  "processedAt": "2026-04-23T10:00:05Z"
}
```

### Managing Dead Letter Queue

```bash
# List dead letter webhooks
curl http://localhost:3000/webhooks/dead-letter

# Requeue a dead letter webhook
curl -X POST http://localhost:3000/webhooks/requeue/{webhookRetryId}

# Response:
{ "success": true }
```

### Monitoring Webhooks

```bash
# List pending webhooks
curl http://localhost:3000/webhooks/pending

# List processing webhooks  
curl http://localhost:3000/webhooks/processing

# Get status of specific webhook
curl http://localhost:3000/webhooks/status/{id}
```

## Configuration

### Default Settings

The system comes with these defaults:

| Setting | Value | Notes |
|---------|-------|-------|
| Initial Delay | 1 second | First retry after 1 second |
| Backoff Multiplier | 2 | Each retry doubles the delay |
| Max Retries | 3 | 3 retry attempts total |
| Max Delay | 1 hour | Caps retry delay at 1 hour |

### Customizing Settings

To change retry behavior, edit `src/payments/webhooks/webhook-retry.processor.ts`:

```typescript
private readonly initialDelayMs = 1000;      // Change this value
private readonly maxDelayMs = 3600000;       // Change this value
private readonly backoffMultiplier = 2;      // Change this value
```

Also update in `WebhookRetry` entity:

```typescript
@Column({ type: 'int', default: 3 })
maxRetries: number;  // Change default here
```

## Testing

### Run Tests

```bash
# Unit tests
npm test -- webhook-queue.service.spec
npm test -- webhook-retry.processor.spec

# E2E tests
npm test -- webhook-retry.e2e-spec

# All webhook tests
npm test -- webhooks
```

### Manual Testing

1. **Using Stripe CLI**:
   ```bash
   stripe listen --forward-to localhost:3000/webhooks/stripe
   stripe trigger payment_intent.succeeded
   ```

2. **Using curl**:
   ```bash
   curl -X POST http://localhost:3000/webhooks/stripe \
     -H "stripe-signature: test" \
     -H "Content-Type: application/json" \
     -d '{"type":"payment_intent.succeeded","id":"evt_123"}'
   ```

3. **Check webhook status**:
   ```bash
   # Get the webhookRetryId from the response above, then:
   curl http://localhost:3000/webhooks/status/{webhookRetryId}
   ```

## Monitoring

### Key Metrics to Watch

1. **Success Rate**: Target >99%
2. **Retry Rate**: Target <10%
3. **Dead Letter Size**: Should stay <100
4. **Processing Time**: Target <1 second

### Viewing in Database

```sql
-- Check webhook statistics
SELECT status, COUNT(*) as count
FROM webhook_retries
GROUP BY status;

-- View recent dead letter webhooks
SELECT id, provider, lastError, createdAt
FROM webhook_retries
WHERE status = 'dead_letter'
ORDER BY createdAt DESC
LIMIT 10;

-- Check pending webhooks
SELECT id, provider, nextRetryTime, retryCount
FROM webhook_retries
WHERE status = 'pending'
AND nextRetryTime <= NOW()
LIMIT 10;
```

## Common Tasks

### How to Requeue a Failed Webhook

1. **Find the webhook**:
   ```bash
   curl http://localhost:3000/webhooks/dead-letter
   ```

2. **Requeue it**:
   ```bash
   curl -X POST http://localhost:3000/webhooks/requeue/{webhookRetryId}
   ```

3. **Monitor progress**:
   ```bash
   curl http://localhost:3000/webhooks/status/{webhookRetryId}
   ```

### How to Check Why a Webhook Failed

```bash
# Get webhook details
curl http://localhost:3000/webhooks/status/{webhookRetryId}

# Look at the response:
{
  "lastError": "Network timeout",
  "errorDetails": {
    "stack": "Error: Network timeout...",
    "timestamp": "2026-04-23T10:05:00Z"
  },
  "retryCount": 3
}
```

### How to Clean Up Old Webhooks

```sql
-- Archive succeeded webhooks older than 30 days
DELETE FROM webhook_retries
WHERE status = 'succeeded'
AND "processedAt" < NOW() - INTERVAL '30 days';

-- Archive dead letter webhooks older than 90 days
DELETE FROM webhook_retries
WHERE status = 'dead_letter'
AND "createdAt" < NOW() - INTERVAL '90 days';
```

## Troubleshooting

### Webhooks Not Being Processed

1. **Check Redis connection**:
   ```bash
   redis-cli ping
   # Should respond: PONG
   ```

2. **Check webhook status**:
   ```bash
   curl http://localhost:3000/webhooks/status/{webhookRetryId}
   # Status should not be "processing" indefinitely
   ```

3. **Check logs**:
   ```bash
   npm run start:dev 2>&1 | grep -i webhook
   ```

### High Dead Letter Queue

1. **List dead letter webhooks**:
   ```bash
   curl http://localhost:3000/webhooks/dead-letter?limit=10
   ```

2. **Review errors** and determine if:
   - Payment provider API is down
   - Webhook signatures are incorrect
   - Database connectivity issues

3. **Fix and requeue**:
   ```bash
   curl -X POST http://localhost:3000/webhooks/requeue/{webhookRetryId}
   ```

### Memory Issues

1. Reduce concurrent job processors in `.env`:
   ```bash
   BULL_CONCURRENCY=1  # Default is 10
   ```

2. Archive old webhooks (see cleanup above)

3. Monitor Redis memory:
   ```bash
   redis-cli INFO memory
   ```

## Integration Points

### PaymentsService

The webhook processor automatically calls PaymentsService methods:
- `updatePaymentStatus()` - Updates payment status
- `processRefundFromWebhook()` - Processes refunds
- `handleSubscriptionEvent()` - Handles subscription changes

### ProviderFactory

Webhook processor uses ProviderFactory to:
- Verify Stripe signatures
- Parse Stripe events
- Handle PayPal events

No changes needed in these services - they work transparently.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Payment Provider                         │
│                  (Stripe / PayPal)                          │
└─────────────┬───────────────────────────────────────────────┘
              │ sends webhook event
              ▼
┌─────────────────────────────────────────────────────────────┐
│              WebhookController                              │
│         (handles POST requests)                             │
└─────────────┬───────────────────────────────────────────────┘
              │ forwards to
              ▼
┌─────────────────────────────────────────────────────────────┐
│              WebhookService                                 │
│      (verifies signature, queues event)                     │
└─────────────┬───────────────────────────────────────────────┘
              │ queues to
              ▼
┌─────────────────────────────────────────────────────────────┐
│              Bull Queue (Redis)                             │
│      (stores job with retry metadata)                       │
└─────────────┬───────────────────────────────────────────────┘
              │ processes with
              ▼
┌─────────────────────────────────────────────────────────────┐
│         WebhookRetryProcessor                               │
│    (exponential backoff, error handling)                    │
└─────────────┬───────────────────────────────────────────────┘
              │ handles event
              ▼
┌─────────────────────────────────────────────────────────────┐
│          PaymentsService                                    │
│     (updates payment status, processes refunds)             │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

1. ✅ **Implementation**: Complete ✓
2. **Testing**: Run unit and E2E tests
3. **Deployment**: Deploy to staging for testing
4. **Monitoring**: Set up alerts for dead letter queue
5. **Documentation**: Share README with ops team
6. **Runbook**: Create runbook for manual webhook requeue

## Support Resources

- **Full Documentation**: `src/payments/webhooks/README.md`
- **Implementation Details**: `WEBHOOK_RETRY_IMPLEMENTATION.md`
- **Migration Helpers**: `src/payments/webhooks/migration-helper.ts`
- **Test Examples**: `src/payments/webhooks/webhook-retry.e2e-spec.ts`

## Questions?

Refer to the comprehensive documentation in:
- `src/payments/webhooks/README.md` - Full documentation
- `WEBHOOK_RETRY_IMPLEMENTATION.md` - Implementation details
- Test files for implementation examples
