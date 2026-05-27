# API Versioning and Deprecation Policy

TeachLink uses header-based API versioning to support stable evolution without changing existing URLs.

## Version header support

Include the `X-API-Version` header with every versioned API request.

Example:

```bash
curl -H "X-API-Version: 1" \
  -H "Authorization: Bearer <token>" \
  https://api.teachlink.com/users
```

## Supported versions

- `1` — current supported version

The API rejects requests with missing or invalid `X-API-Version` values for versioned endpoints.

## Deprecation notices

Deprecated API versions are announced with response headers when a request is still accepted.

Response headers include:

- `Deprecation: true`
- `Sunset: <date>`
- `Link: <https://docs.teachlink.com/api/versioning#migration-guides>; rel="migration"; type="text/html"`
- `X-API-Deprecation-Notice: <message>`

## Migration guides

Migration instructions and version transition notes are documented here in this file.

### Example migration path

- Migrate from `0` to `1` by updating clients to send `X-API-Version: 1`
- Use the current API schema for version `1`
- Verify request and response contracts against the latest OpenAPI documentation

## End-of-life policy

Deprecated versions remain available until the sunset date.

Once a sunset date passes, the API rejects requests to the deprecated version with HTTP `410 Gone`.

### Example lifecycle

- `0` deprecated on `2025-12-31`
- `0` sunset and end-of-life on `2026-06-30`

## Version-neutral endpoints

Certain system routes do not require version headers and remain available without `X-API-Version`:

- `/`
- `/health`
- `/metrics`

## Quick reference

Required headers for versioned endpoints:

```
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token>
X-API-Version: 1
```
