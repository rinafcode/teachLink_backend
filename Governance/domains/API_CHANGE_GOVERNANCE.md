# API Change Governance Policy

This document governs how the public HTTP and GraphQL API of the TeachLink
Backend is changed: what counts as an API change, who reviews and approves
each class of change, how consumers are notified, which regression tests and
documentation a change must ship with, and how a change that turns out to be
wrong is rolled back. It exists so that an API change — a new endpoint, a new
required field, a deprecation — can be made from one versioned reference
instead of being re-derived per pull request.

This policy is part of the project's **Releases & change** area. It lives
entirely inside the `Governance/` folder and does not change application code.

## Scope

An **API change** is any change that alters the contract a consumer programs
against — the set of endpoints, their request and response shapes, their
authentication or authorization requirements, their versioning or
deprecation status, or the errors they can return:

| Class | Examples |
| --- | --- |
| New endpoint or resolver | a new REST route, GraphQL query, mutation, or subscription |
| Contract change | adding or removing a request/response field, renaming a field, changing a field's type or nullability, changing validation constraints, changing a status code |
| Behavioural contract change | new authentication or authorization requirement, new rate limit, changed pagination, changed ordering or filtering semantics |
| Versioning change | introducing a new API version, changing the default version, deprecating a version, setting or advancing a sunset date |
| Documented error surface | a new or changed error response shape or error code clients are expected to handle |

Not every change to a controller file is an API change. Out of scope — these
are governed elsewhere:

- **Internal refactors** that leave the contract identical. Renaming a
  private service, extracting a helper, or restructuring a module behind an
  unchanged endpoint follows the normal review rules in
  [`Governance/README.md`](../README.md), not this policy.
- **Database schema changes.** A migration needed to support an API change is
  governed by [`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md); the API-side
  diff remains governed here.
- **Configuration.** Rate-limit thresholds, cache TTLs, and other
  environment-supplied values are governed by
  [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md) unless the change alters the
  documented contract itself (a *new* limit class exposed to clients is both).
- **Third-party integrations.** Outbound calls to external services are
  governed by [`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md);
  this policy covers the API this project *exposes*.
- **Webhooks this service emits.** Governed by
  [`WEBHOOK_GOVERNANCE.md`](WEBHOOK_GOVERNANCE.md), including their own
  notification rules.

When it is genuinely ambiguous whether a diff changes the contract, the tie
is broken in favour of treating it as an API change: the review overhead is
the point.

## What counts as a breaking change

A change is **breaking** if it can cause a correct existing client to fail.
By this definition, each of the following is breaking:

- Removing an endpoint, field, query, mutation, or enum value.
- Renaming anything a client can see, or changing a field's type,
  nullability, or casing.
- Making a previously optional request field or header required.
- Tightening validation so input a client sends today is rejected.
- Adding a new required authentication or authorization requirement.
- Changing a success status code, or the shape of an error response.
- Changing pagination defaults or limits in a way that hides results a
  client previously received.
- Changing the semantics of an existing parameter (ordering, filtering,
  units) even when the type is unchanged.

Adding a new optional field, a new endpoint, or a new enum value at the end
of a set is **non-breaking**; adding a new required anything is breaking.

Breaking changes are made **only** in a new API version. The API is
versioned by the `X-API-Version` header (see `src/main.ts` and
`src/common/middleware/api-version.middleware.ts`); a breaking change to
version `1` is delivered as version `2` with a deprecation window for
version `1`, never by editing version `1` in place. The deprecation
machinery — the `Deprecation`, `Sunset`, `Link`, and
`X-API-Deprecation-Notice` response headers and the `@Deprecated` decorator —
is the mechanism for that window, documented in `docs/api/versioning.md`.

## Review and approval path

Every API change is reviewed by at least one maintainer. The path depends on
the change class:

| Change | Required approval |
| --- | --- |
| New endpoint or read-only field, contract unchanged otherwise | one maintainer |
| Contract change to an existing endpoint (non-breaking) | one maintainer **plus** the service owner of the module (see [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md)) |
| **Breaking change** (including a new version, a default-version change, or a sunset date) | one maintainer **plus** the service owner, and an explicit sign-off comment from a second maintainer recorded on the PR |
| Change to auth, authorization, or rate limiting of an endpoint | the above **plus** a maintainer with security responsibility (the role model is defined in [`../policies/REVOCATION.md`](../policies/REVOCATION.md)) |
| Change to a payments or personal-data endpoint | the above **plus** the owner recorded for that data domain in [`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md) |

If no service owner is recorded for the module, the general maintainer
rotation is the owner and the PR must name the owner in its first comment
before approval.

The PR body must state, before review begins:

1. **The change class** from the Scope table above.
2. **Whether it is breaking**, and if so, which new version carries it and
   what the deprecation window for the old shape is.
3. **Every consumer-facing surface updated in the same PR** (see
   Documentation below).
4. **The notification** sent to consumers (see Consumer notification below).

A breaking-change PR that does not state these four things is returned
rather than reviewed; the reviewer should not have to reconstruct the
consumer impact from the diff.

## Consumer notification

Consumers are third parties and internal clients programming against the
public contract, including the generated SDKs (`sdk/typescript`,
`sdk/python`). Notification is a **merge requirement**, not a follow-up:

1. **All changes** — the PR updates `CHANGELOG.md` under `[Unreleased]`,
   with breaking changes listed under a `### ⚠ BREAKING CHANGES` heading so
   they cannot be buried.
2. **All changes** — the OpenAPI specification is regenerated in the same PR
   (`pnpm run docs:generate`); `pnpm run docs:check` must pass. The spec is
   the machine-readable contract, so a PR whose spec diff does not match the
   code diff is incomplete.
3. **Breaking changes** — the PR documents a migration path in
   `docs/api/versioning.md` (or a dedicated migration guide linked from it),
   stating what clients must change and by when.
4. **Breaking changes** — deprecated shapes keep serving with the deprecation
   response headers set (`Deprecation: true`, `Sunset: <date>`) for a
   deprecation window of **at least one full release cycle**, and the
   `X-API-Deprecation-Notice` message names the replacement. A sunset date
   earlier than that window needs the second-maintainer sign-off above.
5. **Breaking changes to the SDKs** — the SDKs are regenerated
   (`pnpm run sdk:generate`) or, where they are not regenerated in the same
   PR, the PR states when they will be and who owns it.

For changes with external consumers, an announcement accompanies the
release that carries the change; for internal-only consumers, the PR
mentions the owning teams and they acknowledge on the PR before merge. What
does **not** count as notification: a changelog entry merged silently after
the fact, or a spec diff a consumer is expected to diff themselves.

## Rollback path

API changes are rolled back by **reverting the change**, never by a database
rollback. Because a contract change is committed configuration-like state
— the spec, the docs, and the SDKs travel with the code — `git revert` of the
API change commit followed by a redeploy restores the previous contract.

A rollback is required, not optional, when any of the following is observed
after the change is live:

1. **Existing clients fail** — an integration that worked before the deploy
   does not work after it, for any reason not stated in the PR body.
2. **The contract and the behaviour disagree** — the deployed API does not
   match the regenerated OpenAPI spec.
3. **Deprecation misfire** — a deprecated shape is rejected before its
   sunset date, or deprecation headers are missing while a deprecated shape
   still serves.
4. **Security or authorization regression** — an endpoint is reachable
   without its previous auth requirement, or exposes cross-tenant data.

Reverting supersedes fixing forward when consumers depend on the old shape:
clients cannot be patched on the platform's schedule, so the old contract is
restored first and the corrected change re-lands with a fresh window.

## Regression tests where applicable

An API change ships with tests wherever the behaviour is testable, and the
PR body states why not where it is not:

- **New or changed endpoint** → e2e coverage under `test/` asserting the
  request/response contract, including the error cases clients must handle
  (unauthorized, validation failure, not found), so an accidental status-code
  or shape change fails CI.
- **Validation or auth change** → cases for both sides of the boundary:
  input that must now be rejected is rejected, input that must still be
  accepted is accepted.
- **Versioning or deprecation change** → the existing middleware spec
  pattern (`src/common/middleware/api-version.middleware.spec.ts`) is
  extended: assertions that the old version keeps serving within its window,
  that deprecation headers are set, and that a past-sunset version returns
  `410 Gone`.
- **Contract-shape change** → `pnpm run docs:check` in CI guards the
  generated spec, examples, and docs site against drift from the code.

Where a change is genuinely not testable, the PR body says so explicitly,
and lint, typecheck, and build (the `validate` CI job) remain the minimum
gate. Nothing in this section replaces the general rule that checks are run
and verified locally before a pull request is opened.

## Documentation

- **OpenAPI spec** — regenerated in the same PR (`openapi-spec.json`,
  `docs/api/openapi-spec.json`), including examples where the existing
  generator produces them.
- **`docs/api/`** — the affected page is updated in the same PR; a contract
  that the docs contradict is the documentation defect, not a client bug.
- **`CHANGELOG.md`** — every API change, with breaking changes called out
  as above.
- **`docs/api/versioning.md`** — updated for any versioning or deprecation
  change, including the supported-versions list and the migration path.
- **Pull request body** — the four statements required by the review path
  above, plus the verification evidence: the commands run and their results.
- **Decision record** — a change that establishes a new versioning or
  deprecation convention, or that resolves a genuine either-or, is recorded
  in [`DECISION_LOG.md`](../DECISION_LOG.md) rather than only in the pull
  request, so the reasoning survives the PR.

## Roles and responsibilities

| Role | Responsibility |
| --- | --- |
| Author | Classifies the change, states breakage and consumers, updates spec/docs/SDK/changelog in one PR, ships the regression tests. |
| Reviewer (maintainer) | Verifies the classification, the breakage assessment, the notification, and that the spec diff matches the code diff. |
| Service owner | Signs off on contract changes to their module and owns the consumer list for it. |
| Security reviewer | Signs off when the change touches auth, authorization, or rate limiting. |
| Releaser | Includes the consumer announcement in the release that carries a breaking change. |

## Verification of this policy

This policy is documentation only, so it has no runtime behaviour of its own
to unit test. It is enforced by review and by the checks it requires (the
`validate` CI job, `pnpm run docs:check`, the e2e and middleware specs
above), and its application is auditable through the repository history:
each API change is a commit whose diff shows the contract, the spec, and the
docs updated together, and whose pull request states the breakage and the
notification. When a consumer-facing incident does occur, the review's
handling of it belongs in [`AUDIT_LOG.md`](AUDIT_LOG.md).

## Related documents

- [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md) — environment and feature-flag
  configuration, which this policy defers to for tunables.
- [`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md) — schema changes backing
  an API change.
- [`WEBHOOK_GOVERNANCE.md`](WEBHOOK_GOVERNANCE.md) — outbound webhooks and
  their payload governance.
- [`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md) — outbound
  integrations and data-sharing limits.
- [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md) — who owns an API surface.
- [`AUDIT_LOG.md`](AUDIT_LOG.md) — audit recording, including API incidents.
- [`DECISION_LOG.md`](../DECISION_LOG.md) — where versioning conventions are
  recorded.
- [`Governance/README.md`](../README.md) — the governance structure this
  document belongs to.
