# Webhook Governance Policy

This document governs both directions of webhook traffic in the TeachLink
Backend project: **outbound** delivery to subscriber URLs
(`src/webhooks/`) and **inbound** receipt of provider callbacks
(`src/payments/webhooks/`, `src/email-marketing/email-webhook.controller.ts`).
It exists so every webhook integration, present and future, follows the same
signing, retry, and deprecation rules rather than reinventing them.

This policy is part of the project's **Security & disclosure** and
**Contribution governance** areas. It lives entirely inside the `Governance/`
folder and does not change application code.

## Scope

This policy applies to:

- **Outbound webhooks** — HTTP callbacks this service sends to subscriber
  URLs, delivered via `WebhookDeliveryService` and the retry queue described
  in `src/webhooks/README.md`.
- **Inbound webhooks** — HTTP callbacks received from third-party providers
  (Stripe, SendGrid, and similar), verified by services such as
  `WebhookSecurityService` and `StripeWebhookGuard`.

A new webhook integration in either direction must be reviewed against this
policy before it is merged, and is subject to the vetting checklist in
`Governance/domains/THIRD_PARTY_INTEGRATION.md` if it involves a new external
provider.

## Signing Requirement

- **Outbound.** Every outbound webhook payload is signed with HMAC-SHA256
  over the raw request body, using a per-subscriber secret. The signature is
  sent in a request header and documented to subscribers so they can verify
  it; payloads are never sent unsigned.
- **Inbound.** Every inbound webhook handler verifies the provider's
  signature (or equivalent, e.g. Stripe's signing scheme) before the payload
  is trusted or persisted. A handler that cannot verify a signature must
  reject the request, never process it "for now" and revisit verification
  later.
- **Timestamp and replay checks.** Inbound handlers reject requests whose
  signed timestamp is older than the provider's tolerance window (see
  `WEBHOOK_SECURITY.MAX_TIMESTAMP_AGE_MS`) and de-duplicate by event ID within
  that window, so a captured request cannot be replayed.
- Signing secrets are stored as application secrets (never in source control)
  and are rotatable without downtime: both the previous and current secret
  are accepted for a defined overlap window during rotation.

## Retry and Idempotency Rules

- **Outbound delivery** retries with exponential backoff and jitter, capped at
  a configured maximum delay and a configured maximum attempt count, exactly
  as implemented in `webhook-backoff.util.ts` and `webhook-retry.config.ts`.
  Only retryable failures (5xx, 408, 425, 429, and transport errors) are
  retried; permanent 4xx failures are dead-lettered immediately rather than
  retried.
- Delivery attempts that exhaust retries are dead-lettered and raise a
  monitoring alert (`webhook-monitor.service.ts`), never silently dropped.
- **Inbound handling** must be idempotent per event ID: reprocessing the same
  provider event (a legitimate provider retry) must not duplicate side
  effects such as charges, emails, or state transitions.
- A subscriber (outbound) or this service (inbound) may legitimately receive
  the same logical event more than once; the receiving side, not the sender,
  is responsible for de-duplicating.

## Deprecation Path

- A webhook event type or payload shape is not removed or changed in a
  breaking way without a deprecation notice period of at least 90 days.
- Deprecation is announced in the relevant module's `README.md` and, for
  outbound webhooks with external subscribers, communicated directly to
  known subscribers where a contact channel exists.
- During the deprecation window, the old and new shapes are both honoured
  (outbound) or both accepted (inbound) so integrators can migrate without a
  hard cutover.
- Removing a deprecated webhook integration entirely (provider retirement,
  feature sunset) follows the same review as adding one: recorded in the
  tracking issue, and the corresponding entry in
  `Governance/domains/THIRD_PARTY_INTEGRATION.md`'s register is retired.

## Review

This policy is reviewed whenever a new webhook provider or subscriber pattern
is added, or the retry/backoff defaults change materially. Changes are
proposed through the normal governance process described in
`Governance/README.md` and must touch only the `Governance/` folder.
