# Wire all 4 Blaqkenny-assigned issues into real call paths

## Summary

Closes all 4 issues assigned to **Blaqkenny** in one PR:

| Issue | Title | Service (already shipped via PR #957) | This PR integrates it via |
|-------|-------|--------------------------------------|--------------------------|
| **#798** | Redis-backed per-IP failed-attempt counter | `src/security/threats/threat-detection.service.ts` | `src/auth/auth.controller.ts` — login flow |
| **#799** | OAuth provider tokens encrypted at rest | `src/auth/services/social-auth.service.ts` | (already wired by PR #957 via Google/GitHub strategies) |
| **#801** | SHA-256 hashed password-reset & email-verify tokens | `src/auth/services/auth-tokens.service.ts` | `src/auth/auth.controller.ts` — new endpoints + `src/auth/auth.service.ts` |
| **#805** | OpenAI moderation adapter + circuit-breaker fallback | `src/moderation/safety/content-safety.service.ts` | `src/moderation/auto/auto-moderation.service.ts` — new `classifyContentSafety` / `moderateContent` methods |

The four services already had **complete implementations** with comprehensive unit tests on `main` (merged via PR #957, Blaqkenny/Fix-rinafcode). What was missing was the **runtime call site** that actually invokes each service from production code. This PR adds those.

## Why a wiring PR

Audit of `main` showed three of the four services were never invoked at runtime:

| Issue | Had service? | Had unit tests? | Had a runtime call site before this PR? |
|-------|--------------|-----------------|----------------------------------------|
| #798 | ✅ | ✅ | ❌ login never called `analyzeRequest`/`recordFailure`/`reset` |
| #799 | ✅ | ✅ | ✅ already wired by GoogleStrategy/GitHubStrategy |
| #801 | ✅ | ✅ | ❌ no controller endpoint exposed `issuePasswordReset`/`consumePasswordReset`/`consumeEmailVerification` |
| #805 | ✅ | ✅ | ❌ `ContentSafetyService.scoreContent` was exported but no caller invoked it |

A service that isn't called at runtime isn't really fixed. This PR closes the wiring gaps so all four Blaqkenny fixes actually protect end-users.

## What changed

### 1. **Issue #798** — per-IP brute-force protection on `POST /auth/login`

`src/auth/auth.controller.ts` now injects `ThreatDetectionService` and:

1. Calls `analyzeRequest(ip)` **before** looking up the user. If the count already exceeds the configured threshold (default 10) the request is refused with `403 Forbidden`.
2. Calls `recordFailure(ip)` whenever an unknown email or wrong password is presented.
3. Calls `reset(ip)` on successful authentication so a legitimate user's counter is cleared.

`extractClientIp(req)` resolves `req.ip` first (Express `trust proxy` aware — wired in `src/main.ts`) and falls back to `x-forwarded-for` then to `0.0.0.0` for sanity.

### 2. **Issue #801** — Real password-reset & email-verification endpoints

Three new HTTP endpoints on `src/auth/auth.controller.ts`:

| Endpoint | Behaviour | Status |
|----------|-----------|--------|
| `POST /auth/forgot-password` | Issues a SHA-256-hashed reset token via `AuthTokensService.issuePasswordReset`. Always returns `delivered: true` to avoid leaking which emails are registered. In non-production environments the raw token is also returned (dev/QA convenience) — never in production. | Public |
| `POST /auth/reset-password` | Calls `AuthTokensService.consumePasswordReset(rawToken)`. On match bcrypt-hashes the new password, writes it, and rotates the refresh token so a stolen-refresh scenario can't survive. Token is single-use (consumed atomically). | Public |
| `POST /auth/verify-email` | Calls `AuthTokensService.consumeEmailVerification(rawToken)`. Sets `isEmailVerified=true` on match. | Public |

`src/auth/auth.service.ts` injects `AuthTokensService` and exposes `requestPasswordReset`, `resetPassword`, `verifyEmailToken`, `issueEmailVerificationToken`.

Three matching DTOs added under `src/auth/dto/`:
- `forgot-password.dto.ts`
- `reset-password.dto.ts`
- `verify-email.dto.ts`

### 3. **Issue #805** — ContentSafetyService exposed via AutoModerationService

`src/moderation/auto/auto-moderation.service.ts` now injects `ContentSafetyService` and exposes:

| Method | Path | Use |
|--------|------|-----|
| `analyze(content)` | HuggingFace toxicity classifier | Unchanged — legacy path, low-latency bulk ingestion |
| `classifyContentSafety(content)` | OpenAI / circuit-breaker fallback #805 | New — adversarial input, homoglyph-resistant |
| `moderateContent(content)` | Both in parallel; max(hf, safety) | New — union verdict; cannot be bypassed by either model failing |

The combined threshold (0.7) and the score-reason wiring match the existing `analyze` return shape so downstream callers (e.g. `ContentReportingService`) can swap to `moderateContent` without signature changes.

## Files added

| File | Purpose |
|------|---------|
| `src/auth/dto/forgot-password.dto.ts` | Body validation for `/auth/forgot-password` |
| `src/auth/dto/reset-password.dto.ts` | Body validation for `/auth/reset-password` |
| `src/auth/dto/verify-email.dto.ts` | Body validation for `/auth/verify-email` |
| `src/auth/auth.controller.spec.ts` | Integration test that proves the wiring (#798 + #801) |
| `src/moderation/auto/auto-moderation.service.spec.ts` | Integration test that proves the wiring (#805) |
| `PR_DESCRIPTION_BLAQKENNY.md` | This file |

## Files modified

| File | Change |
|------|--------|
| `src/auth/auth.controller.ts` | + `ThreatDetectionService` injection; + 3 new endpoints (forgot/reset/verify-email); + `extractClientIp` helper |
| `src/auth/auth.service.ts` | + `AuthTokensService` injection; + `requestPasswordReset`, `resetPassword`, `verifyEmailToken`, `issueEmailVerificationToken` methods |

`AutoModerationService` was extended (imports added, two new methods) but the `analyze` method is preserved so existing callers (`ContentReportingService`, manual review queue) keep working.

## Testing

Manually verified with `node` REPL:

```ts
// #798 — recordFailure then analyzeRequest should trip the threshold
threat.recordFailure('1.2.3.4'); // x10 → analyzeRequest throws ForbiddenOperationException

// #801 — forgot-password issues hashed token; reset-password consumes it
const r = await auth.forgotPassword({ email: 'x@y.com' });
const verified = await auth.resetPassword(r.rawToken, 'NewStrongPass1!');
```

Spec-side the new `auth.controller.spec.ts` boots a Test module with all dependencies stubbed and asserts:
- `analyzeRequest` is called BEFORE any DB lookup on `POST /auth/login`
- `recordFailure` is called on wrong password / unknown email
- `reset` is called on successful login
- `forgotPassword` issues a token via `AuthTokensService`
- `resetPassword` consumes the token and updates `password`
- `verifyEmail` flips `isEmailVerified`

`auto-moderation.service.spec.ts` asserts:
- `analyze` still works (HuggingFace path unchanged)
- `classifyContentSafety` invokes `ContentSafetyService.scoreContent` and maps the score
- `moderateContent` returns `max(hf, safety)` so a homoglyph bypass doesn't pass

## Notes for reviewers

- `ThreatDetectionService.analyzeRequest` fails OPEN on Redis errors (existing behaviour). High-volume callers should NOT replace this with a `fail closed` policy without first confirming the Redis SLA.
- `forgot-password` deliberately does not reveal whether the email exists — a 200 is always returned. The raw token is omitted from the response in production (`NODE_ENV=production`).
- `reset-password` invalidates the user's refresh token post-reset so a token-theft scenario during the password-reset flow cannot survive.
- `AutoModerationService.moderateContent` is additive — existing callers can continue to use `analyze` if they only want the HuggingFace verdict.

## Migration

No new migrations required. The four supporting migrations already shipped via PR #957:

| Timestamp | Migration | Issue |
|-----------|-----------|-------|
| 1783000000000 | `clear-plaintext-auth-tokens.ts` | #801 |
| 1783000000001 | `reencrypt-oauth-provider-tokens.ts` | #799 |
| 1783000000002 | `add-auth-token-indexes.ts` | #832 (follow-up) |

`ENCRYPTION_SECRET` must be present in the deploy environment for re-encryption to run.

## Closure

Closes: **#798**, **#799**, **#801**, **#805**.
