# TODO - Idempotency Alternative (no POST /payments present)

## Goal
Apply idempotency + add tests to POST routes that *do exist* in this workspace (currently `SubscriptionsController` POST endpoints).

## Steps
1. Add `@Idempotent({ ttl: 86400 })` to POST handlers in `src/payments/subscriptions/subscriptions.controller.ts`:
   - `POST /subscriptions/:subscriptionId/upgrade`
   - `POST /subscriptions/:subscriptionId/downgrade`
2. Ensure `IdempotencyModule` / `IdempotencyInterceptor` is registered for these controller handlers (module-level wiring or controller-level interceptors, based on existing Nest patterns).
3. Add an e2e test similar to `test/idempotency.e2e-spec.ts` using the existing Redis in-memory stub to validate:
   - repeated POST with same `Idempotency-Key` returns cached response and the service executes only once.
4. Run `npm test` (or `npm run test:e2e` for the specific file) and verify compilation.

## Progress
- ✅ Added `@Idempotent({ ttl: 86400 })` to `SubscriptionsController` POST endpoints.
- ✅ Added `test/subscriptions-idempotency.e2e-spec.ts` to cover dedupe behavior.
- ⏳ Needs CI/build verification (tools can’t reliably capture `npm test` output here).


