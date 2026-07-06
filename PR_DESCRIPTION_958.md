# PR Title

fix(security): validate bcrypt passwordHistory and ownership-check distlock release (#797, #807)

## Summary

This PR resolves both security issues assigned to `judithJn`, hardening a high-impact code path on every password change (`users.passwordHistory`) and eliminating a Redis lock-takeover vulnerability in the distributed orchestration layer.

## Issue #797 — `DistributedLockService.releaseLock` did not validate lock ownership

**Risk:** the old `releaseLock` issued a plain Redis `DEL`, so any caller that knew the key could release a lock it did not own — a critical race condition for payment processing and payout disbursements.

**Fix in `src/orchestration/locks/distributed-lock.service.ts`:**

- `acquireLock` now generates a UUID v4 token and stores it as the Redis value via `SET key token PX <ttl> NX`. Return type is `Promise<string | null>` — the token on success, `null` when contended.
- `releaseLock(key, token)` runs a Redis Lua `EVAL` script that **atomically** does a `GET`+`DEL`: the key is deleted only if the stored token matches the caller-supplied one; otherwise Redis returns `0`. Return type is `Promise<boolean>` so callers can tell a successful release from a rejected one.
- The Lua script is the single source of truth for atomicity — no race window between check and delete, and no raw `DEL` is ever issued (regression-guarded by a unit test).

## Issue #807 — `User.passwordHistory` could be persisted as plaintext

**Risk:** `User.passwordHistory` is a `string[]`/`text[]` column with no application-level validation. A programming error could push raw passwords into that array and they would then live in the database indefinitely.

**Fix delivered in two layers:**

1. **Persistence gate** — new `src/users/entities/password-history.subscriber.ts`:
   - TypeORM `@EventSubscriber` on the `User` entity.
   - `@BeforeInsert` and `@BeforeUpdate` validate every entry of `passwordHistory` against `BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/`, covering all real bcrypt variants (`$2a$`, `$2b$`, `$2y$`) and rejecting phpass (`$2x$`), MD5-crypt (`$1$`), and plaintext.
   - Rejects with `InternalServerErrorException` and a logged safe preview, because plaintext reaching the persistence layer indicates a backend bug, not a user error.
   - Discovery follows the existing `TenantRlsSubscriber` pattern (`@EventSubscriber()` decorator + `users.module.ts` provider entry).
2. **Service gate** — defence-in-depth in `src/users/services/password-history.service.ts`:
   - `addToHistory(...)` now refuses any non-bcrypt payload with `BadRequestException` before the change ever leaves the application.

JSDoc on `User.passwordHistory` now documents the invariant and points at the subscriber.

## Test coverage

- `src/users/entities/password-history.subscriber.spec.ts` — 26 tests:
  - `listenTo` returns the User entity.
  - `beforeInsert`: empty/undefined history passes; valid `$2a$`/`$2b$`/`$2y$` hashes pass; plaintext, malformed cost factor, wrong algorithm tag, and `$2x$` phpass are rejected with `InternalServerErrorException`.
  - `beforeUpdate`: skips when `passwordHistory` is not in `updatedColumns`; validates the proposed entity value; warns-and-skips when the ORM event has no in-place entity (partial-update path); explicitly does NOT validate against `databaseEntity` (which holds the OLD row state — that would have been a silent bypass).
  - Direct `BCRYPT_HASH_REGEX` checks including `$2x$` rejection.
- `src/orchestration/locks/distributed-lock.service.spec.ts` — 11 tests:
  - `acquireLock` returns a UUID v4 token on success, `null` on contention, uses 5 s default TTL, generates a fresh token per call, and stores it with `PX <ttl> NX`.
  - `releaseLock` invokes Redis `EVAL` with the correct script/keys/token, returns `true`/`false`/`false` for integer-1/integer-0/string-'0' respectively, and **never** calls `DEL` — the regression guard for issue #797.
  - Ownership security: a release attempt with a wrong token returns `false`; the legitimate owner still succeeds with their real token.

All 37 new tests pass. `pnpm typecheck` passes cleanly.

## Files changed

- `src/orchestration/locks/distributed-lock.service.ts` *(modified)*
- `src/orchestration/locks/distributed-lock.service.spec.ts` *(new)*
- `src/users/entities/user.entity.ts` *(JSDoc only)*
- `src/users/services/password-history.service.ts` *(modified — service gate)*
- `src/users/entities/password-history.subscriber.ts` *(new)*
- `src/users/entities/password-history.subscriber.spec.ts` *(new)*
- `src/users/users.module.ts` *(subscriber provider registered)*

## Breaking API changes

- `DistributedLockService.acquireLock(key, ttl)` returns `Promise<string | null>` (was `Promise<boolean>`). Callers must now capture the token.
- `DistributedLockService.releaseLock(key)` now requires a `(key, token)` signature and returns `Promise<boolean>` (was `Promise<void>`). The plain `DEL` fallback is deliberately not provided.
