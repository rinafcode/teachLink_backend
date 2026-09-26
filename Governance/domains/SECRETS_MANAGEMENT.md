# Secrets Management Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers & Security Group (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-26
- **Review cadence:** Quarterly, or immediately after any suspected secret exposure

This document governs the lifecycle of every secret in the TeachLink Backend
project: where a secret value is permitted to live, how it is accessed at
runtime, how often it must be rotated, and the practices that are prohibited
outright. It exists so that contributors, maintainers, operators, and
compliance stakeholders have one versioned reference for handling
credentials — rather than re-deriving the rules per pull request, or copying
a value into a place it should never reach.

This policy is part of the project's **Security & disclosure** area. It lives
entirely inside the `Governance/` folder and does not change application code.

A **secret** is any value whose disclosure would grant access, impersonate an
identity, decrypt protected data, or otherwise weaken the platform's security
posture. Non-exhaustive examples: database and cache passwords, JWT signing
and refresh secrets, the application encryption secret and salt, cloud access
keys, third-party API keys (Stripe, SendGrid), webhook signing secrets, SMTP
credentials, secret-store access tokens, and the private key material behind
any of the above. Per
[`DATA_CLASSIFICATION.md`](DATA_CLASSIFICATION.md), secret material is always
treated as the most sensitive category regardless of how a given value is
otherwise labelled.

## 1. Scope

This policy applies to every human and machine identity that creates, stores,
reads, transmits, or rotates a secret in the course of working on or operating
TeachLink Backend.

In scope:

- Application secrets read at runtime through `ConfigService` and the
  environment.
- Secrets managed through the project's secret providers in
  `src/security/secrets/` (AWS Secrets Manager, HashiCorp Vault).
- Credentials used by CI/CD, deployment manifests, scheduled tasks, and
  outbound integrations.
- The key names, defaults, and validation of secrets in `.env.example`,
  `.env.staging`, `src/config/env.validation.ts`, and
  `scripts/validate-env.js`.

Out of scope — governed elsewhere, but still bound by this policy's
prohibited practices:

- **End-user credentials.** Password storage and verification follow
  [`DATA_CLASSIFICATION.md`](DATA_CLASSIFICATION.md) and the authentication
  rules in [`ACCESS_CONTROL.md`](ACCESS_CONTROL.md); a user's password is
  never stored as a readable secret.
- **Configuration keys and defaults.** The key list, validation, parity, and
  rollback path for configuration are governed by
  [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md). This policy governs the *values*
  those keys hold.
- **Third-party vetting and data sharing.** Governed by
  [`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md); credential
  handling for an integration follows both documents.

## 2. Where Secrets May Live

A secret value may exist in exactly one of the approved locations below. When
the same logical secret is needed in more than one environment, each
environment holds its own value — values are never copied between
environments (see §5, Prohibited Practices).

### 2.1 Approved Storage Locations

| Environment | Location | Rules |
| --- | --- | --- |
| Local development | The developer's own uncommitted `.env` file (gitignored) | Populated from the placeholders in `.env.example`; never committed and never shared in chat, issues, or pull requests. |
| CI/CD | GitHub Actions repository or organization secrets, injected into the workflow `env:` block for the job that needs them | Scoped to the minimum job and permission set; no secret is echoed to logs; a pipeline secret is rotated like any other credential. |
| Staging and production | A managed secret store — **AWS Secrets Manager** (`SecretsManagerService`) or **HashiCorp Vault** (`VaultSecretsService`) — selected by `SECRET_PROVIDER` (`env` \| `aws` \| `vault`) | Values are fetched at runtime through `src/security/secrets/` and cached in memory only (see §3.4). The provider is chosen per environment; the same key name and meaning must exist in every environment. |
| Kubernetes / Helm deployment | `Secret` objects and the secret templates under `k8s/` and `helm/` (`helm/teachlink-backend/templates/secret.yaml`, `charts/teachlink-backend/templates/secret.yaml`) | Committed manifests carry references and placeholders only; literal values are supplied at deploy time from the managed secret store (or an external-secrets mechanism), never committed. |
| Provider dashboards | The third party's own console (for example Stripe or SendGrid) | This is the source of truth for that credential; the platform's copy lives in the managed secret store and is rotated at the provider first, then updated in the store. |

`.env.example` and `.env.staging` are **documentation, not secret stores**:
they carry placeholders and comments only. Committing a real credential
anywhere is an incident, handled as described in
[`AUDIT_LOG.md`](AUDIT_LOG.md) — not as a review comment to be quietly fixed.

### 2.2 Provider Selection and Boot-Time Validation

- `SECRET_PROVIDER` selects the provider. A provider that is not configured
  fails closed: a missing or malformed required secret must fail the boot
  rather than degrade to an empty default. Validation lives in the Joi schema
  in `src/config/env.validation.ts`, is covered by
  `src/config/env.validation.spec.ts`, and is checked pre-deploy by
  `scripts/validate-env.js` (`pnpm run validate:env`) against `.env.example`.
- Adding a new secret key means adding it to `.env.example`, to the
  validation schema, and to `ENV_SPEC` in `scripts/validate-env.js` in the
  same pull request, following [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md).
- The secret store is the only sanctioned source for values in staging and
  production. Reading a secret directly from a committed file, an image, or a
  deployment manifest in those environments is out of policy.

## 3. Handling Rules

### 3.1 Access and Least Privilege

- Access to secret values follows the least-privilege, default-deny, and
  separation-of-duties rules in [`ACCESS_CONTROL.md`](ACCESS_CONTROL.md).
- Secret-store read access is scoped per environment and per service; no
  identity holds production secret access it does not need.
- Production secret access is time-bound where the platform supports it, and
  every grant is approved and revocable through the access-request process in
  [`ACCESS_CONTROL.md`](ACCESS_CONTROL.md).
- Production secrets are never copied to a developer workstation. If a
  production issue truly requires a value, it is handled through a break-glass
  access path with an auditable record, not by exporting the secret.

### 3.2 Transmission and Storage

- Secrets are encrypted in transit on every connection that carries them —
  TLS is mandatory; plaintext HTTP, unencrypted queue payloads, and secrets in
  URL query strings are prohibited.
- Secrets are encrypted at rest wherever they are persisted; the managed
  secret store is responsible for encryption of stored values.
- Private keys and key material are never written to the database, to build
  artifacts, or to container images.

### 3.3 Logging and Observability

- Secret values must never appear in application logs, error messages, stack
  traces, metrics labels, traces, audit details, or webhook payloads.
- Log payloads pass through the sensitive-data masker
  (`src/logging/sensitive-data.masker.ts`), which redacts known sensitive keys
  (`secret`, `token`, `apikey`, `private_key`, `password`, and similar) before
  they are emitted. Code that logs structured data must use it rather than
  serialising raw configuration.
- The secret-management API (`src/security/secrets/secrets.controller.ts`) is
  restricted to the `ADMIN` role and returns redacted metadata only; no
  endpoint returns a secret value.
- A secret that renders in a log, an error response, or a screenshot is
  treated as exposed and must be rotated.

### 3.4 Caching

- Secret values may be cached in process memory only, with a bounded TTL
  (`SECRET_CACHE_TTL_MS`, default `300000` ms). The cache is invalidated on
  every update or rotation (`updateSecret` clears the entry), so a rotated
  value takes effect without a restart.
- Caches are never persisted to disk, Redis, or any shared store, and are
  never logged.

## 4. Rotation Cadence

Rotation limits the value of an undetected exposure: a credential that is
rotated on schedule is useful to an attacker only for the remaining window.
The intervals below are **maximums** — rotating sooner is always permitted and
is required on the trigger conditions in §4.2.

### 4.1 Maximum Rotation Intervals

| Secret class | Representative keys / code | Maximum interval | Notes |
| --- | --- | --- | --- |
| Database credentials | `DATABASE_PASSWORD`, `DATABASE_REPLICA_PASSWORD` | 90 days | Rotate with a dual-credential overlap so pools reconnect without downtime. |
| JWT signing secrets | `JWT_SECRET`, `JWT_SECRETS` with `JWT_SECRET_CURRENT_VERSION` | 90 days | Key-version overlap is already supported: both the previous and current version are accepted during the window. |
| Session and refresh secrets | `JWT_REFRESH_SECRET`, `SESSION_SECRET` | 90 days | Rotating invalidates outstanding sessions as designed; communicate the cutover. |
| Symmetric encryption | `ENCRYPTION_SECRET`, `ENCRYPTION_SALT` | 180 days | Requires a re-encryption or key-versioning plan; old ciphertext must remain readable or be migrated in the same change. |
| Third-party API keys | `STRIPE_SECRET_KEY`, `SENDGRID_API_KEY` | 90 days | Rotate at the provider first, then update the secret store and verify the integration. |
| Webhook signing secrets | `STRIPE_WEBHOOK_SECRET`, per-subscriber outbound secrets | 90 days, or on subscriber request | Both the previous and current secret are accepted during a defined overlap window, per [`WEBHOOK_GOVERNANCE.md`](WEBHOOK_GOVERNANCE.md). |
| Cloud access keys | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | 90 days | Prefer role/workload identity over long-lived static keys; static keys are a fallback, not a default. |
| Secret-store access tokens | `VAULT_TOKEN` | 30 days | Prefer short-lived, least-privilege tokens; a token is scoped to only the paths the environment reads. |
| Infrastructure passwords | `REDIS_PASSWORD`, `REDIS_SENTINEL_PASSWORD`, `ELASTICSEARCH_PASSWORD`, `SMTP_PASS` | 90 days | Rotate with the same overlap approach as database credentials where the service supports it. |
| Operational API tokens | `METRICS_AUTH_TOKEN` | 90 days | Scope to the endpoint it protects. |

The automated weekly rotation implemented by
`SecretsManagerService.rotateCriticalSecrets()`
(`@Cron(CronExpression.EVERY_WEEK)`) rotates every secret named in
`SECRETS_TO_ROTATE` once a week — the mechanism, not a replacement for this
table. The set is expected to include the highest-value secrets (the
`.env.example` example lists `JWT_SECRET`, `DATABASE_PASSWORD`,
`STRIPE_SECRET_KEY`). A secret that is not eligible for automated rotation
(for example, one that requires a provider-side action) is rotated manually on
its maximum interval and recorded as such.

### 4.2 Rotation Triggers

Rotate the affected secret immediately — ahead of any scheduled interval —
when any of the following occurs:

- A secret is suspected or confirmed exposed (leaked log, screenshot, commit,
  chat message, third-party breach, or an unexpected access alert).
- A person with access to the secret leaves the project, following
  [`Governance/processes/OFFBOARDING.md`](../processes/OFFBOARDING.md) and
  [`Governance/policies/REVOCATION.md`](../policies/REVOCATION.md).
- The provider publishes a security advisory affecting the credential.
- A rotation interval is exceeded because a scheduled job failed.
- A shared or copied credential is discovered in an unapproved location.

An exposure is handled as a security incident under
`src/incident-management/`, and the rotation is recorded through the audit log
in `src/audit-log/` (a secret or secret-store configuration change is a
configuration change, `AuditAction.CONFIG_CHANGED`; suspected exposure is
raised as a security event). Rotation of a compromised credential is the
remediation, not a reason to delay reporting.

### 4.3 Rotation Requirements

- **No downtime.** Because a rotated credential and the old value may be
  needed simultaneously, rotation proceeds through the overlap supported by
  the subsystem — `JWT_SECRETS` versioning for signing keys, dual secrets for
  webhook signatures, and a dual-credential window for database passwords. A
  change that cannot overlap (for example, an encryption key) ships with the
  migration or re-encryption plan in the same pull request.
- **Verify after rotating.** The dependent flow is exercised after rotation
  — login and token refresh for JWT secrets, a test delivery for webhook
  secrets, a connection check for database credentials — before the old value
  is removed.
- **Staging first.** Rotation is rehearsed in staging before production; a
  rotation that misbehaves in staging is fixed there first.
- **Record the rotation.** The date, the secret class (not the value), the
  actor, and the verification result are recorded so the next review can
  confirm the cadence was met. Secret values are never written into the
  record.
- **Decommission, don't abandon.** A secret no longer in use is deleted from
  the store and any provider, rather than left active for convenience.

## 5. Prohibited Practices

The following are prohibited without exception. A pull request containing one
of them is not eligible to merge, and a discovered instance in a live
environment is an incident.

1. **Committing a secret value to source control.** This includes `.env`,
   `.env.staging`, deployment manifests, Dockerfiles, `docker-compose*.yml`,
   test fixtures, CI workflow files, examples, and documentation. Committed
   files carry placeholders only.
2. **Printing, echoing, or logging a secret value.** Not in application logs,
   CI output, error messages, stack traces, debug output, metrics labels, or
   audit details. Structured logging goes through the sensitive-data masker.
3. **Returning a secret value from an API.** Secret endpoints return redacted
   metadata only; no endpoint exposes the value to a client.
4. **Sharing a credential between people, services, or environments.**
   Every identity and environment has its own credential; shared, generic, or
   multi-user secrets are forbidden, per
   [`ACCESS_CONTROL.md`](ACCESS_CONTROL.md).
5. **Copying production secrets into staging, development, test, or a
   personal environment.** Each environment holds its own values of the same
   keys.
6. **Transmitting a secret over an unencrypted channel or in a URL.**
   No plaintext HTTP, no query-string parameters, no unencrypted message
   payloads.
7. **Hardcoding a fallback secret in code.** A missing secret fails closed at
   boot; it never silently falls back to a default that works.
8. **Storing a secret in the database in plain text**, or in any location the
   application can read without the secret store. Historical plaintext
   credentials were removed by
   `src/migrations/1783000000000-clear-plaintext-auth-tokens.ts` and
   `src/migrations/1783000000006-clear-legacy-bcrypt-refresh-tokens.ts`; no new
   plaintext path may be introduced.
9. **Long-lived static cloud keys where a role or workload identity is
   available.** Static keys are a documented fallback, not the default.
10. **Pasting a secret into an unapproved tool** — a chat message, an issue or
    pull request, a screenshot, a ticket, a shared document, or a deployment
    dashboard outside the approved store.
11. **Weakening or disabling protection to make something work** — removing a
    validation rule, extending a token lifetime without justification, or
    turning off rotation so a stale credential keeps functioning.
12. **Bypassing review for a secret-handling change.** Changes to how secrets
    are stored, read, rotated, or validated require review by the area
    reviewer named in [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md), in
    addition to the normal maintainer review.

## 6. Regression Tests Where Applicable

This document is a governance-only, documentation-only change. It introduces
no runtime behaviour, no schema change, and no executable code, so it adds no
tests and requires none. Existing lint, typecheck, build, and test suites must
continue to pass, verified by the `validate` job in
`.github/workflows/ci.yml` described in `CONTRIBUTING.md`.

When a future code change touches secret storage, retrieval, rotation, or
masking, that change ships with tests that enforce this policy, including:

- **No secret in output** — coverage that sensitive keys are redacted by
  `src/logging/sensitive-data.masker.spec.ts` and that security events do not
  carry credentials, following `src/security/audit/security-event-logger.spec.ts`.
- **Rotation takes effect** — a unit test that a rotation or update clears the
  in-process cache and that the new value is returned on the next read, for
  `SecretsManagerService` and `VaultSecretsService`.
- **Rotation is safe** — the token-rotation behaviour exercised by
  `test/auth-rotation.e2e-spec.ts`, extended where a new key-version overlap is
  introduced.
- **Fail-closed boot** — a case in `src/config/env.validation.spec.ts`
  asserting that a missing or malformed required secret is rejected rather than
  defaulted.
- **Encryption integrity** — where key handling changes,
  `src/security/encryption/encryption.service.spec.ts` covers encrypt/decrypt
  compatibility across the rotation window.

## 7. Documenting Changes

- **Policy amendments.** Any change to this policy is submitted as a pull
  request that touches only the `Governance/` folder. Substantive changes —
  altering a rotation interval, adding an approved storage location, or
  changing a prohibited practice — are reviewed through the normal governance
  process in `Governance/README.md` and, where they resolve a genuine
  either-or, recorded in [`DECISION_LOG.md`](../DECISION_LOG.md).
- **Secret-handling code changes.** A change that adds a secret key, switches
  provider, or alters rotation behaviour updates `.env.example`, the
  validation schema, and the pull request body together, following
  [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md), and states the rotation and rollback
  path for the value.
- **Change log.**

| Version | Date | Description of Change |
| --- | --- | --- |
| 1.0.0 | 2026-09-26 | Initial Secrets Management Policy establishing approved storage locations, rotation cadence and triggers, prohibited practices, and regression-test requirements. |

## 8. Review

This policy is reviewed quarterly, and immediately after any suspected or
confirmed secret exposure, provider security advisory, or change to the secret
providers in `src/security/secrets/`. Changes are proposed through the normal
governance process described in `Governance/README.md` and must touch only the
`Governance/` folder.

## 9. Related Documents

- [`CONFIG_CHANGE.md`](CONFIG_CHANGE.md) — configuration keys, validation,
  parity, and rollback; this policy governs the values those keys hold.
- [`ACCESS_CONTROL.md`](ACCESS_CONTROL.md) — least privilege, access requests,
  MFA, and the access-review cadence that governs who may read a secret.
- [`DATA_CLASSIFICATION.md`](DATA_CLASSIFICATION.md) — classification and
  handling rules; secret material is always the most sensitive category.
- [`AUDIT_LOG.md`](AUDIT_LOG.md) — audit recording for secret-store
  configuration changes and configuration incidents.
- [`LOGGING_RETENTION.md`](LOGGING_RETENTION.md) — retention limits that bound
  how long any log containing sensitive metadata may be held.
- [`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md) — vetting and
  data-sharing limits for integrations whose credentials this policy governs.
- [`WEBHOOK_GOVERNANCE.md`](WEBHOOK_GOVERNANCE.md) — signing-secret rotation
  and the overlap window for webhook secrets.
- [`CRON_GOVERNANCE.md`](CRON_GOVERNANCE.md) — idempotency and monitoring
  expectations for the scheduled rotation task.
- [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md) — the owner and area reviewer
  for the secret-handling surface being changed.
- [`Governance/policies/REVOCATION.md`](../policies/REVOCATION.md) — grounds
  and process for revoking credentials and privileges.
- [`Governance/processes/OFFBOARDING.md`](../processes/OFFBOARDING.md) —
  access removal and credential rotation when a contributor leaves.
- [`Governance/roles/MAINTAINER.md`](../roles/MAINTAINER.md) — maintainer
  responsibilities and review authority.
- [`docs/secrets-and-idempotency.md`](../../docs/secrets-and-idempotency.md) —
  operator-facing reference for the secret providers and the secrets API.
- [`Governance/README.md`](../README.md) — the governance structure this
  document belongs to.
