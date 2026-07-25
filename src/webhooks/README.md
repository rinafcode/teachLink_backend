# Outbound Webhook Delivery (with retries & backoff)

Reliable delivery of **outbound** webhooks to subscriber URLs, with exponential
backoff, a configurable retry queue, dead-letter handling and failure
monitoring.

> Implements issue **#615 — Add webhook delivery retries with exponential backoff**.
>
> This is distinct from [`src/payments/webhooks`](../payments/webhooks), which
> handles *inbound* Stripe/PayPal webhooks.

## Acceptance criteria mapping

| Criterion | Where |
| --------- | ----- |
| **Retry queue for failed webhooks** | Bull queue re-enqueues retryable failures; `WebhookDeliveryService.buildJobOptions()` sets `attempts` + `backoff`. The worker re-throws `WebhookRetryableError` so the job is requeued. |
| **Exponential backoff implemented** | [`webhook-backoff.util.ts`](./webhook-backoff.util.ts) → `calculateBackoffDelay()` (exponential + equal jitter + max-delay cap). |
| **Max retry count configured** | [`webhook-retry.config.ts`](./webhook-retry.config.ts) → `maxRetries` (env `WEBHOOK_MAX_RETRIES`, default 5). |
| **Monitoring for failures** | [`webhook-monitor.service.ts`](./webhook-monitor.service.ts) → counters + alert-thresholded metrics via `CustomMetricsService`, plus `webhook.*` events. |

## Components

- **`webhook-retry.config.ts`** — retry policy, env-overridable, with defaults.
- **`webhook-backoff.util.ts`** — pure helpers: `calculateBackoffDelay`,
  `shouldRetry`, `isRetryableStatusCode`, `isRetryableError`.
- **`webhook-delivery.service.ts`** — signs (HMAC-SHA256) and POSTs the webhook,
  classifies failures, schedules retries or dead-letters, emits events.
- **`webhook-monitor.service.ts`** — in-memory counters + `CustomMetricsService`
  forwarding; alert fires on dead-letter.
- **`webhooks-delivery.module.ts`** — Nest module (HTTP + monitoring wiring).
- **`workers/processors/webhooks.worker.ts`** — Bull worker delegating to the
  delivery service.

## Retry behaviour

```
attempt 1 ──fail(5xx/timeout/network)──▶ wait ~1s  ─▶ attempt 2
attempt 2 ──fail──────────────────────▶ wait ~2s  ─▶ attempt 3
attempt 3 ──fail──────────────────────▶ wait ~4s  ─▶ ... up to maxRetries
                                              │
              permanent 4xx ◀───────────────┘ (no retry → dead-letter)
              retries exhausted ─────────────▶ dead-letter + alert
```

- Delay = `initialDelayMs × multiplier^(attempt-1)`, capped at `maxDelayMs`,
  with **equal jitter** (50–100% of the computed delay) to avoid thundering herds.
- **Retryable**: HTTP 5xx, 408, 425, 429, and transport errors (ECONNRESET,
  ETIMEDOUT, …). **Permanent**: other 4xx → dead-lettered immediately.

## Configuration

| Env var | Default | Meaning |
| ------- | ------- | ------- |
| `WEBHOOK_MAX_RETRIES` | `5` | Max delivery attempts before dead-letter |
| `WEBHOOK_INITIAL_DELAY_MS` | `1000` | Base backoff delay |
| `WEBHOOK_BACKOFF_MULTIPLIER` | `2` | Exponential growth factor |
| `WEBHOOK_MAX_DELAY_MS` | `3600000` | Backoff cap (1h) |
| `WEBHOOK_JITTER` | `true` | Apply equal jitter |
| `WEBHOOK_TIMEOUT_MS` | `10000` | Per-request timeout |

## Usage

Enqueue a webhook job onto the `webhooks` Bull queue with options from the
service so retries/backoff match the policy:

```ts
await webhooksQueue.add(
  'deliver',
  { url, event: 'course.completed', payload, secret },
  webhookDeliveryService.buildJobOptions(),
);
```

Subscribe to delivery events for auditing/alerting:

```ts
@OnEvent('webhook.dead_letter')
onDeadLetter(e) { /* page on-call, persist for manual replay */ }
```

## Tests

```bash
npm test -- src/webhooks
```

- `webhook-backoff.util.spec.ts` — backoff growth, cap, jitter bounds, retryability.
- `webhook-delivery.service.spec.ts` — success, retryable vs permanent failures,
  exhaustion/dead-letter, HMAC signing, job options.
