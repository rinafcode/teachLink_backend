# PR Title

fix(gdpr): revoke active sessions during user erasure

## Summary

Fixes #821.

GDPR erasure previously anonymized the user profile but left Redis-backed sessions and refresh-token material intact. This allowed an erased user to continue authenticating with previously issued session state.

## What changed

- Added session revocation during GDPR erasure by deleting all Redis sessions belonging to the user.
- Cleared the user's refresh token during erasure so old refresh-token-based flows are invalidated.
- Added regression tests covering both:
  - GDPR erasure invoking session cleanup, and
  - session service removal of all sessions for a specific user.

## Why

This brings the erasure flow into compliance with GDPR data-erasure expectations by ensuring previously valid session state is invalidated immediately when a user is erased.

## Testing

Verified locally with:

```bash
cd /home/gift/teachLink_backend && npx jest --runInBand src/modules/gdpr/tests/gdpr.service.spec.ts src/session/session.service.spec.ts
```

Result:
- 2/2 test suites passed
- 17/17 tests passed
