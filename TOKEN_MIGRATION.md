# Token Migration Guide

This document outlines the migration path for existing active sessions after the implementation of Refresh Token Rotation (Issue #508).

## Background
The previous JWT implementation lacked refresh token rotation and did not issue refresh tokens with a unique `jti` (JWT ID). This increased the risk of token compromise. The new implementation requires all refresh tokens to have a `jti` and automatically rotates them upon each refresh request, maintaining a Redis-backed blacklist of revoked tokens.

## Migration Steps

Since legacy tokens lack a `jti` or were not stored as bcrypt hashes in the user's `refreshToken` column, existing user sessions cannot be automatically upgraded seamlessly without compromising the new security constraints. 

To ensure security, the following migration strategy is enforced:

1. **Invalidate Legacy Sessions**: All previous refresh tokens that lack a valid `jti` or do not match the new bcrypt hash stored in the database will automatically be rejected by the new `AuthService.refreshTokens` flow.
2. **Force Re-authentication**: Users attempting to refresh their tokens using a legacy refresh token will receive a `401 Unauthorized` response.
3. **Client-Side Handling**: Frontend and mobile clients should be updated to handle the `401 Unauthorized` on the `/auth/refresh` endpoint by redirecting the user to the login screen.
4. **New Sessions**: Once the user logs in again via `/auth/login`, they will be issued a new, compliant refresh token pair with a `jti` and the token hash will be securely stored.

### Expected Impact
- All currently logged-in users will be required to log in again once their short-lived access tokens expire.
- No database migration scripts are necessary for the `users` table since the `refreshToken` column will simply be overwritten with the new hashed tokens upon their next login.

## Security Note
This "hard" migration ensures that any potentially compromised legacy tokens are immediately rendered useless, fulfilling the security enhancements required by the ticket.
