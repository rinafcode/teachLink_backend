# API Deprecation Policy

This document governs how API endpoints, fields, and contracts in the
TeachLink Backend are deprecated and eventually removed: the deprecation
headers and notices that must accompany a deprecated surface, the minimum
support window before removal is permitted, and the removal approval required
before a deprecated surface is deleted. It exists so that API consumers —
internal services, mobile clients, and third-party integrators — have a
predictable, versioned contract for how long a deprecated surface will remain
available and what signals to watch.

This policy is part of the project's **Releases & change** area. It lives
entirely inside the `Governance/` folder and does not change application code.

## Scope

This policy applies to:

- **REST endpoints** defined in the NestJS controllers under `src/`.
- **Response body fields and request parameters** that are part of a
  committed, documented contract.
- **OpenAPI schema objects** published in `openapi-spec.json`.
- **SDK method signatures** under `sdk/` that wrap the above.
- **Internal service interfaces** that cross a module boundary and are consumed
  by more than one module.

Out of scope:

- Undocumented, internal-only routes guarded behind `@Internal()` or
  equivalent that have never appeared in the published OpenAPI spec.
- Breaking changes that fix a security vulnerability: these follow the
  security-disclosure process and may skip the deprecation window when
  waiting would pose an active risk.

## Deprecation Headers and Notices

When a surface is designated deprecated, all of the following must be in place
**in the same pull request** that introduces the deprecation:

1. **HTTP `Deprecation` header.** Every response from a deprecated endpoint
   carries a `Deprecation` header whose value is an HTTP-date indicating when
   the deprecation was declared (per [RFC 8594](https://datatracker.ietf.org/doc/html/rfc8594)).
   Example: `Deprecation: Sat, 01 Mar 2025 00:00:00 GMT`.

2. **HTTP `Sunset` header.** Every response from a deprecated endpoint carries
   a `Sunset` header whose value is the planned removal date, at least as far
   in the future as the minimum support window requires (see below). Example:
   `Sunset: Tue, 01 Sep 2025 00:00:00 GMT`.

3. **`@deprecated` JSDoc tag.** The NestJS controller method, DTO field, or
   SDK method is annotated with `@deprecated <reason> — use <replacement>
   instead. Removal planned: <ISO date>.`

4. **`@ApiProperty` description update.** For any field in a DTO or OpenAPI
   schema, the `@ApiProperty` description is updated to read `DEPRECATED:
   <reason>. Use <replacement> instead.`

5. **OpenAPI spec update.** The endpoint or field in `openapi-spec.json` is
   marked with `deprecated: true` and the description carries the sunset date
   and replacement reference.

6. **Changelog entry.** `CHANGELOG.md` is updated under the current release
   section to record the deprecation, the reason, the replacement, and the
   planned removal date.

7. **Migration guide or replacement reference.** The pull request body and the
   JSDoc / `@ApiProperty` description reference the replacement endpoint or
   field (or the workaround if no direct replacement exists).

## Minimum Support Window

A deprecated surface must remain functional for at least the following periods
before it may be removed, measured from the date the deprecation was first
shipped to a production environment:

| Consumer type | Minimum window |
|---|---|
| Internal services (same repository) | 4 weeks |
| External consumers (third-party integrators, mobile clients) | 12 weeks |
| Published SDK methods | 12 weeks |

The window begins when the deprecation ships to production, not when the pull
request merges.

**Extension.** If an external consumer has formally notified the project (via
an issue or direct communication) that they cannot complete migration within
the standard window, the on-call maintainer may extend the sunset date. Any
extension is recorded in `CHANGELOG.md` and the `Sunset` header is updated.

**Emergency removal.** A deprecated surface may be removed before the window
expires only to resolve a confirmed security vulnerability. This must be
approved by two maintainers, communicated to known consumers with as much
notice as practical, and recorded in `CHANGELOG.md`.

## Removal Approval

Removal of a deprecated surface requires explicit approval before the
removal pull request is merged:

1. **Window confirmation.** The pull request body states the date the
   deprecation shipped to production and confirms the minimum support window
   has elapsed.
2. **Consumer check.** The author checks open issues and pull requests for
   evidence of ongoing consumer use. If any consumer has raised a concern, it
   must be resolved or formally acknowledged before removal proceeds.
3. **Two-maintainer sign-off.** At least two maintainers approve the removal
   pull request. For SDK removals that break a published interface, one of the
   two must be the SDK owner per
   [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md).
4. **Changelog updated.** `CHANGELOG.md` records the removal in the same pull
   request, noting which deprecated surface was removed and when it was
   originally deprecated.
5. **OpenAPI spec updated.** The endpoint or field is removed from
   `openapi-spec.json` in the same pull request as the code removal, so the
   spec and code are never out of step.

A removal that fails any of the above criteria is not merged. A reviewer who
identifies a gap during review blocks the pull request until the gap is closed.

## Regression Tests Where Applicable

This document is a governance-only, documentation-only change. It introduces
no runtime behaviour, no schema change, and no executable code, so it adds no
tests and requires none. When a future change deprecates or removes an
endpoint or field, that change ships with:

- A test asserting that the `Deprecation` and `Sunset` response headers are
  present and correctly formatted on the deprecated endpoint.
- A test confirming the replacement endpoint or field is functional, so the
  migration path is proven before the deprecated surface is removed.

Existing lint, typecheck, build, and test suites must continue to pass, and
the change is verified by the standard CI pipeline described in `CONTRIBUTING.md`.

## Review

This policy is reviewed at least once a year, or whenever the project's
release cadence or API versioning strategy changes materially. Changes are
proposed through the normal governance process described in
`Governance/README.md` and must touch only the `Governance/` folder.

## Related Documents

- [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md) — governs configuration changes that
  may accompany an endpoint deprecation.
- [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md) — identifies the owner whose
  sign-off is required for removal of an SDK or service interface.
- [`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md) — integrators
  subject to the external consumer support window.
- [`AUDIT_LOG.md`](AUDIT_LOG.md) — audit recording for security-driven early
  removals.
- [`Governance/README.md`](../README.md) — the governance structure this
  document belongs to.
