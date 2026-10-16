# API Versioning Policy

This document governs how API versions are assigned, maintained, and retired in
the TeachLink Backend project: the versioning scheme applied to endpoints and
contracts, the sunset timeline for old versions, and the compatibility
guarantees consumers can rely on. It exists so that API consumers — internal
services, mobile clients, and third-party integrators — have a single,
versioned reference for what the version identifier means and how long a version
will remain supported.

This policy is part of the project's **Releases & change** area. It lives
entirely inside the `Governance/` folder and does not change application code.

## Scope

This policy applies to:

- **REST endpoints** defined in the NestJS controllers under `src/` that are
  exposed in the published OpenAPI spec (`openapi-spec.json`).
- **SDK method signatures** under `sdk/` that wrap the above.
- **Versioned URL prefixes** such as `/v1/`, `/v2/`, that appear in route
  definitions or in `config/routing.json`.

Out of scope:

- Internal service-to-service calls that never leave the process boundary and
  are not exposed in the OpenAPI spec.
- Webhook payload schemas — these are governed by
  [`WEBHOOK_GOVERNANCE.md`](WEBHOOK_GOVERNANCE.md).
- Breaking changes driven by a security vulnerability, which follow the
  security-disclosure process and may move faster than the timelines below.

## Versioning Scheme

TeachLink Backend uses a **URL-path major-version prefix** for its public API.
The version segment appears as the first path component after the service root:

```
/v{MAJOR}/resource
/v{MAJOR}/resource/{id}/sub-resource
```

Examples: `/v1/courses`, `/v2/users/me/enrolments`.

**Version increment rules:**

| Change type | Version impact |
|---|---|
| New endpoint, new optional field, new enum value, extended response | No version bump — additive changes are backward-compatible |
| Renamed, removed, or type-changed field; removed endpoint; changed authentication requirement; narrowed enum | Major version bump required |
| Bug fix that changes documented-incorrect behaviour | Major version bump if consumers may depend on the incorrect behaviour; otherwise no bump with a changelog entry |

A new major version (`/v2/`, `/v3/`, …) is introduced only when a breaking
change cannot be avoided through an expand–migrate–contract sequence (see
[`SCHEMA_CHANGE.md`](SCHEMA_CHANGE.md)). Introducing a new major version is
a significant commitment and requires the approval of at least two maintainers
recorded in [`Governance/DECISION_LOG.md`](../DECISION_LOG.md).

The current stable version and any versions under sunset are listed in the
OpenAPI spec's `info.x-api-versions` extension field.

## Sunset Timeline for Old Versions

When a new major version is introduced, the previous version enters a
**sunset period** during which it remains fully functional. The sunset period
is a **minimum** — the version is removed only after the period has elapsed
and the removal approval below has been granted.

| Consumer type | Minimum sunset period |
|---|---|
| Internal services (same repository) | 8 weeks from the new version shipping to production |
| External consumers (third-party integrators, mobile clients) | 6 months from the new version shipping to production |
| Published SDK | 6 months from the new SDK version shipping |

**Sunset signalling.** From the moment a version enters its sunset period:

1. Every response from the sunsetted version carries a `Deprecation` header
   (the date the sunset period began) and a `Sunset` header (the planned
   removal date), per [`API_DEPRECATION.md`](API_DEPRECATION.md).
2. The OpenAPI spec marks the sunsetted version's endpoints with
   `deprecated: true` and a description noting the removal date and the
   replacement version.
3. `CHANGELOG.md` records the sunset start date, the removal date, and the
   replacement version.

**Extension.** If a known external consumer formally notifies the project that
it cannot complete migration within the standard window, a maintainer may extend
the sunset date. Any extension is recorded in `CHANGELOG.md` and the `Sunset`
header is updated.

## Compatibility Guarantees

Within a single major version, TeachLink Backend guarantees the following to
consumers:

1. **Additive-only changes.** New optional fields, new endpoints, and new enum
   values may be added at any time without a version bump. Consumers must be
   written to ignore unknown fields (be tolerant of additions).
2. **No removal without a new major version.** A field, endpoint, or behaviour
   present in a major version will not be removed or made breaking within that
   version. The only exception is a confirmed security vulnerability (see Scope
   above).
3. **Stable authentication contract.** The authentication method (JWT bearer
   token, scopes, header names) does not change within a major version.
4. **Stable error shape.** The top-level structure of error responses (`status`,
   `message`, `code`) does not change within a major version. New error codes
   may be added.
5. **Stable pagination contract.** Pagination parameters (`page`, `pageSize`,
   cursor fields) and the pagination metadata envelope in responses do not
   change within a major version.

These guarantees apply to documented, stable endpoints. Endpoints or fields
marked `x-unstable: true` in the OpenAPI spec carry no compatibility guarantee
and may change without a version bump; they are excluded from the above.

## Removal Approval

Removing a sunsetted version requires explicit approval before the removal pull
request is merged:

1. **Window confirmation.** The PR body states the date the sunset period began
   and confirms the minimum period has elapsed.
2. **Consumer check.** The author checks open issues and PRs for evidence of
   ongoing consumer use of the sunsetted version.
3. **Two-maintainer sign-off.** At least two maintainers approve the removal PR.
4. **OpenAPI spec and routing config updated.** The sunsetted version's
   endpoints are removed from `openapi-spec.json` and `config/routing.json` in
   the same PR as the code removal.
5. **Changelog updated.** `CHANGELOG.md` records the removal, the original
   sunset start date, and the replacement version.

## Regression Tests Where Applicable

This document is a governance-only, documentation-only change. It introduces no
runtime behaviour, no schema change, and no executable code, so it adds no tests
and requires none. When a future change introduces a new major version or retires
an old one, that change ships with:

- A test asserting that the `Deprecation` and `Sunset` headers are present on
  the sunsetted version's endpoints.
- A test confirming the replacement-version endpoints are functional, so the
  migration path is proven before the sunsetted version is removed.

Existing lint, typecheck, build, and test suites must continue to pass, and the
change is verified by the standard CI pipeline described in `CONTRIBUTING.md`.

## Review

This policy is reviewed at least once a year, or whenever the project's API
strategy, OpenAPI spec structure, or release cadence changes materially. Changes
are proposed through the normal governance process described in
`Governance/README.md` and must touch only the `Governance/` folder.

## Related Documents

- [`API_DEPRECATION.md`](API_DEPRECATION.md) — deprecation headers, notices,
  and removal approval for individual endpoints within a version.
- [`SCHEMA_CHANGE.md`](SCHEMA_CHANGE.md) — backward-compatibility rules for
  database schema changes that accompany API changes.
- [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md) — configuration changes that may
  accompany a version introduction.
- [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md) — who owns the API surfaces
  whose versioning is governed here.
- [`WEBHOOK_GOVERNANCE.md`](WEBHOOK_GOVERNANCE.md) — versioning for webhook
  payload schemas, which is out of scope here.
- [`Governance/DECISION_LOG.md`](../DECISION_LOG.md) — where new major version
  decisions and brand-usage permission decisions are recorded.
- [`Governance/README.md`](../README.md) — the governance structure this
  document belongs to.
