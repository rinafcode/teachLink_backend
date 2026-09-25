# Configuration Change Governance Policy

This document governs how configuration changes in the TeachLink Backend are
proposed, reviewed, deployed, and rolled back: which changes count as
configuration changes, what a reviewer must verify before one merges, the
environment-parity rule every change is held to, the rollback path for each
kind of change, and the regression tests and documentation it must ship with.
It exists so that a configuration change — a new environment variable, a new
default, a flag flip — can be made from one versioned reference instead of
being re-derived per pull request.

This policy is part of the project's **Releases & change** area. It lives
entirely inside the `Governance/` folder and does not change application code.

## Scope

A **configuration change** is any change to a value that alters how the
service behaves *without* changing a code branch — that is, a change an
operator could otherwise make directly in an environment to alter production
behaviour:

| Surface | Location |
| --- | --- |
| Environment variables | `.env.example`, `.env.staging`, the `env:` block of the `validate` job in `.github/workflows/ci.yml` |
| Boot-time validation | `src/config/env.validation.ts` (the Joi `envValidationSchema`, wired through `validationSchema` in `src/app.module.ts`) and `src/config/env.validation.spec.ts` |
| Pre-deploy validation | `scripts/validate-env.js` (`pnpm run validate:env`), which validates against `.env.example` |
| Config modules | `src/config/cache.config.ts`, `cors.config.ts`, `database.config.ts`, `elasticsearch.config.ts`, `feature-flags.config.ts`, `retention.config.ts` and their `*.spec.ts` |
| Feature flags | the `defaultFeatureFlags` defaults and `IFeatureFlagsConfig` contract in `src/config/feature-flags.config.ts` |
| Committed configuration data | `config/routing.json`, read by `src/routing/services/routing-config.service.ts` and verified by `scripts/verify-routing.js` |
| Deployment configuration | `docker-compose.yml`, `docker-compose.staging.yml`, `helm/teachlink-backend/values.yaml`, `k8s/configmap.yaml`, `k8s/secret.yaml`, `k8s/base/`, `k8s/canary/`, `charts/teachlink-backend/` |

Out of scope — these are governed elsewhere:

- **Schema changes.** Database migrations are governed by
  [`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md). A change that needs a
  migration to take effect is not a configuration change; if a configuration
  change turns out to require one, it stops being governed here and that
  policy applies.
- **Code changes that merely read configuration.** Adding a new consumer of an
  existing key is an application change and follows the normal review rules in
  [`Governance/README.md`](../README.md); the rules below apply to the
  configuration value itself.
- **Secret material.** The *values* of secrets are never committed (see
  Review below) and are managed in the platform's secret store; this policy
  governs the *keys*, their validation, their defaults, and the rollback path
  (see Rollback below).

## Review of configuration changes

Every configuration change is reviewed by at least one maintainer, and has an
identified owner from the review. The review is over the committed
configuration, not over a running environment, so all of the following must be
true in the pull request itself:

1. **The key exists everywhere it needs to.** A new or renamed key is added to
   `.env.example` (the canonical key list) in the same PR, and to every other
   surface from the Scope table that the environment actually reads.
2. **Validation knows about it.** A new required or shaped key is added to the
   Joi schema in `src/config/env.validation.ts` with its type and default, with
   matching cases in `src/config/env.validation.spec.ts`, and to `ENV_SPEC` in
   `scripts/validate-env.js` (see the parity rule below for why both).
3. **The default is safe.** A missing value must fail closed at boot rather
   than degrade security or silently disable a safeguard. A new feature flag
   defaults to `false` unless the feature is generally available — the
   existing exceptions in `defaultFeatureFlags` (`ENABLE_AB_TESTING`,
   `ENABLE_DATA_WAREHOUSE`, `ENABLE_GRAPHQL`) are exactly the not-yet-GA flags.
   A rate limit, timeout, or retention default may not be weakened without an
   explicit justification in the PR body.
4. **No secret values, ever.** `.env.example` and `.env.staging` carry
   placeholders only. Committing a real credential is an incident and is
   handled under [`AUDIT_LOG.md`](AUDIT_LOG.md), not as a review comment.
5. **Nothing unrelated.** The change is limited to the configuration surfaces
   it needs; a config PR is not the place for incidental refactors.
6. **The rollback step is stated.** The PR body names how this specific change
   is rolled back (see Rollback below).
7. **Documentation is updated** as described in Documentation below.

A configuration change that touches authentication, authorization, rate
limiting, encryption, or a third-party integration's credentials additionally
requires sign-off from the reviewer responsible for that area, because a
wrong-but-valid default there is a security change, not a performance one. See
[`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md) for ownership and
[`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md) for the
integration side of that review.

The minimum CI evidence attached to the PR is the `validate` job from
`.github/workflows/ci.yml` (lint, typecheck, build, migration checks) plus
`pnpm run validate:env` run locally against `.env.example`. A change to the
CI `env:` block is itself part of the diff under review, so it cannot be used
to paper over a missing key.

## Environment-parity rule

A configuration change is not complete until every environment surface it
affects is updated in the **same pull request**. Concretely:

- **Presence and shape must match across environments; values may differ.**
  The same key name, the same type, the same validation, and the same meaning
  in development, staging, and production. Hosts, ports, credentials, and
  other environment-specific values legitimately differ; a key that exists in
  staging but not production does not.
- **`.env.example` is the single source of truth for the key list.** It is
  what `scripts/validate-env.js` validates against and what a new contributor
  copies to start a local environment, so a key that is not listed there is
  effectively undocumented. Adding a key anywhere without adding it here is
  the most common parity defect and is a review blocker.
- **The invariant is enforced twice on purpose.** The Joi schema
  (`src/config/env.validation.ts`) fails the boot of a misconfigured
  environment; `scripts/validate-env.js` catches the same mistake before a
  deploy, against `.env.example`. When the two disagree — a key required by
  boot but absent from the checklist, or vice versa — that is a bug in the
  change, not a reason to relax either one, because the boot check is what
  protects the running service and the checklist is what protects the
  environment being prepared.
- **CI is a production-shaped environment.** A key a test depends on is added
  to the `env:` block of the `validate` job; a change that only works because
  a developer's local `.env` happens to define a key is untested.
- **Declared divergence is allowed, silent divergence is not.** If an
  environment genuinely must differ — an optional integration disabled in
  staging, a replica configuration only present in production — the PR body
  states it, the key's `.env.example` comment records the default and the
  allowed alternatives, and, where the difference is load-bearing, a test
  covers both branches.
- **Deployment manifests are configuration too.** A key added to
  `helm/teachlink-backend/values.yaml` but not to the `k8s/` manifests (or the
  reverse) is the same defect at a different layer.

## Rollback path

Configuration changes are rolled back by **reverting the change**, never by a
database rollback. There are two cases, and the PR body must say which one
applies and what the exact step is:

1. **Committed configuration** — defaults and validation in `src/config/`,
   `.env.example`, `config/routing.json`, and the deployment manifests. The
   rollback is a `git revert` of the configuration commit followed by a
   redeploy, exactly like a code defect. This is the reason defaults live in
   committed files rather than only in an environment: they are reviewable and
   revertible.
2. **Deployed environment values** — the plain values and secret values set in
   a running environment. The rollback is to restore the last known-good value
   from the environment's configuration history and restart the service. If
   that value is not recoverable, the documented default in `.env.example` is
   the fallback, which is another reason the default must be safe.

**A rollback is required, not optional, when any of the following is
observed after the change is live:**

1. **Boot or deploy failure** — the service does not start, or the Joi schema
   rejects the environment. This is the designed failure mode and the
   immediate response is to restore the previous configuration, not to relax
   the schema.
2. **Security or authorization regression** — a guard, rate limit, encryption
   parameter, or credential is weaker than before, or a feature flag exposes
   unauthenticated or cross-tenant behaviour.
3. **Availability or capacity degradation** — pool sizes, timeouts, cache
   limits, or retention windows changed such that the service degrades under
   load and the condition does not clear promptly.
4. **Flag misfire** — a flag is enabled in an environment where the gated
   module is not ready, or a default flip changes behaviour for users who did
   not opt in.
5. **Divergence discovered** — a parity gap between environments is found
   after merge; closing the gap and re-establishing parity is the fix.

**Feature flags are the fast path.** When a change is behind a flag, the first
rollback step is always to disable the flag, which takes effect without a
redeploy of code; whether to additionally revert the code is then a separate
decision. Flag changes are auditable through
`src/config/feature-flag-audit.service.ts`.

**Changes that cannot be reverted in place.** A rotated credential, a changed
encryption parameter, or any value whose old state is destroyed by the change
is not revertible by `git revert`. Such a change must be shipped with an
overlap window in which both the old and new values are accepted — the
codebase already supports this for JWT secrets (`JWT_SECRETS` with
`JWT_SECRET_CURRENT_VERSION`) — and the PR body must state when the old value
will be removed. Until the overlap ends, the rollback is "point back at the
old value", which is why the window exists.

**No migration is involved.** If a configuration rollback would require a
schema change, the change was mis-scoped and [`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md)
governs from that point.

## Regression tests where applicable

A configuration change ships with tests wherever the behaviour is testable,
and the PR body states why not where it is not:

- **New or changed environment key** → matching cases in
  `src/config/env.validation.spec.ts`, asserting both that a valid value is
  accepted and that a missing or malformed value is rejected with the
  intended default applied.
- **New or changed config module** → a unit spec next to it, following the
  existing pattern (`src/config/cache.config.spec.ts`,
  `src/config/database.config.spec.ts`), including the default-value assertions
  so a silent default flip fails CI.
- **`config/routing.json` change** → `scripts/verify-routing.js` plus the
  `routing-config.service` tests, so an unreachable or malformed route table
  is caught before deploy.
- **Feature flag default change** → asserted in a test as well as changed in
  `defaultFeatureFlags`, and covered by
  `src/config/feature-flag-audit.service.spec.ts`; a default is never changed
  by editing the constant alone.
- **CI environment change** → covered by the `validate` job that consumes it;
  no separate test is expected.
- **Deployment manifest change** → the manifests are validated by the deploy
  pipeline; a value that changes runtime behaviour also needs the
  corresponding config-module test above.

Where a change is genuinely not testable — a documentation-only edit, a
comment on an existing key, or a value with no code path — the PR body says so
explicitly, and the `validate` job remains the minimum gate. Nothing in this
section replaces the general rule that checks are run and verified locally
before a pull request is opened.

## Documentation

- **`.env.example`** — every key carries a comment stating its purpose, format,
  default, and whether it is required, so the file doubles as the operator
  reference.
- **Project documentation** — a change that alters operator-visible behaviour
  updates the relevant page under `docs/` (or the runbook or deployment
  guide), and `CHANGELOG.md` follows the project's release process. A
  configuration change that changes a documented default without updating the
  document that quotes it is incomplete.
- **Pull request body** — what changed and why, which environments and
  surfaces were updated, the parity impact (including any declared
  divergence), the rollback step, and the verification evidence: the commands
  run and their results.
- **Decision record** — a change that establishes a new configuration
  convention, or that resolves a genuine either-or, is recorded in
  [`DECISION_LOG.md`](../DECISION_LOG.md) rather than only in the pull
  request, so the reasoning survives the PR.

## Roles and responsibilities

| Role | Responsibility |
| --- | --- |
| Author | Updates every affected surface in one PR, states the rollback step and verification evidence, keeps the change minimal. |
| Reviewer (maintainer) | Verifies parity across environments, safe defaults, validation coverage, and that the stated rollback is executable. |
| Area reviewer | Signs off when the change touches auth, authorization, rate limiting, encryption, or an integration's credentials. |
| On-call maintainer | Executes the rollback when a trigger above is observed, and restores the last known-good configuration. |

## Verification of this policy

This policy is documentation only, so it has no runtime behaviour of its own
to unit test. It is enforced by review and by the checks it requires (the
`validate` CI job, `pnpm run validate:env`, and the specs above), and its
application is auditable through the repository history: each configuration
change is a commit whose diff shows the surfaces updated together, and whose
pull request states the rollback step. When a configuration incident does
occur, the review's handling of it belongs in
[`AUDIT_LOG.md`](AUDIT_LOG.md).

## Related documents

- [`MIGRATION_ROLLBACK.md`](MIGRATION_ROLLBACK.md) — schema changes, which this policy defers to.
- [`AUDIT_LOG.md`](AUDIT_LOG.md) — audit recording, including configuration incidents.
- [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md) — who owns a configuration surface.
- [`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md) — credentials and review for external integrations.
- [`WEBHOOK_GOVERNANCE.md`](WEBHOOK_GOVERNANCE.md) — webhook secrets and endpoint configuration.
- [`LOGGING_RETENTION.md`](LOGGING_RETENTION.md) — retention configuration.
- [`Governance/README.md`](../README.md) — the governance structure this document belongs to.
