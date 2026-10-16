# Access Control Governance Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers & Security Group (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-25
- **Review cadence:** Quarterly, or after any security incident or major access change

This document governs access control across the TeachLink Backend project: the
enforcement of the principle of least privilege, the formal access-request and
provisioning procedure, the separation of operational duties, and the periodic
review cadence for all human and machine credentials. It exists so that
contributors, maintainers, operators, and compliance stakeholders have a clear,
versioned reference for how permissions are granted, audited, and revoked rather
than managing access through informal or ad-hoc requests.

This policy is part of the project's **Security & disclosure** and **Roles &
membership** areas. It lives entirely inside the `Governance/` folder and does
not change application code.

---

## 1. Scope & Access Tiers

Access control governs all identities (human contributors, maintainers, service
accounts, and automated integrations) accessing TeachLink Backend resources
across five distinct tiers:

| Tier | Surface | Governed Resources & Roles | Enforcement Mechanism |
| --- | --- | --- | --- |
| **Tier 1: Repository & Code** | GitHub repository & organization | Read, Triage, Write (Committer), Maintain, Admin roles; branch protection bypass permissions | GitHub Organization RBAC, protected branch rules (`CONTRIBUTING.md` §4) |
| **Tier 2: Infrastructure & Deployments** | Cloud environments (AWS/GCP), Kubernetes clusters, Helm charts | Staging & production cluster access, pod exec, ingress management, deployment pipelines | Cloud IAM, cluster RBAC, kubeconfig profiles |
| **Tier 3: Configuration & Secrets** | Secrets manager, environment variables, database credentials | Production database connection strings, JWT signing keys, payment provider keys (Stripe, SendGrid), webhook secrets | Secrets management vault, `.env` parity rules (`Governance/domains/CONFIG_CHANGE.md`) |
| **Tier 4: Application RBAC** | TeachLink Backend runtime APIs | Built-in system roles (`student`, `teacher`, `instructor`, `moderator`, `admin`) and custom permissions | `RolesGuard` (`src/auth/guards/roles.guard.ts`), `rbac.module.ts`, `@Roles()` decorators |
| **Tier 5: Machine & Service Identities** | CI/CD runners, scheduled crons, webhook dispatchers, third-party callbacks | GitHub Actions tokens, cron workers (`Governance/domains/CRON_GOVERNANCE.md`), outbound webhook signing keys | Scoped API tokens, HMAC verification (`Governance/domains/WEBHOOK_GOVERNANCE.md`) |

---

## 2. Principle of Least Privilege

All access decisions in TeachLink Backend must strictly adhere to the
**Principle of Least Privilege (PoLP)**:

1. **Default-Deny Baseline (Zero Trust):**
   - By default, no user, contributor, or machine identity has access to any
     elevated resource or environment. All permissions must be explicitly granted
     and justified.
   - Missing or ambiguous authentication tokens fail closed (`401 Unauthorized` /
     `403 Forbidden`).
2. **Minimal Necessary Scope:**
   - Permissions are granted only for the specific roles, paths, and environments
     required to perform an assigned task. Access to production is never granted
     when access to staging or local sandbox suffices.
   - Broad or wildcard permission grants (e.g. cloud `*.*` admin policies, global
     DB superuser accounts) are prohibited.
3. **Separation of Duties & Dual Custody:**
   - No single individual possesses unchecked authority to author, approve, and
     deploy critical changes.
   - Pull request authors cannot approve their own pull requests. Changes to
     `main` require two maintainer approvals, including at least one designated
     module owner (`CONTRIBUTING.md` §9 and `Governance/roles/MAINTAINER.md`).
   - Production schema rollbacks require dual sign-off from the primary service
     owner and a maintainer (`Governance/domains/MIGRATION_ROLLBACK.md`).
   - Audit logs are append-only and immutable; no operator or service account has
     permission to alter or soft-delete audit records (`Governance/domains/AUDIT_LOG.md`).
4. **Time-Bound & Ephemeral Access (Just-in-Time):**
   - Elevated operational access (such as production database query access, pod
     debugging, or emergency configuration toggling) must be time-boxed with an
     automatic expiry not exceeding 4 hours. Standing administrative privileges
     on production environments are forbidden.
5. **Break-Glass & Emergency Access:**
   - Emergency access procedures bypass routine multi-day approval only during
     active production incidents (`IncidentSeverity.CRITICAL`).
   - Invocation of break-glass access immediately alerts the on-duty security
     team, records an immutable audit event (`SecurityEventType.PRIVILEGE_ESCALATION`),
     and mandates a retrospective review within 72 hours per
     `Governance/domains/POSTMORTEM_POLICY.md`.
6. **Credential Hygiene & Account Integrity:**
   - Multi-factor authentication (MFA/2FA) is mandatory for all contributors,
     maintainers, and administrators.
   - Shared accounts, generic logins, and multi-user credentials are strictly
     prohibited. Every human and automated identity must be uniquely identifiable.
   - Secrets and private keys must never be committed to source control or logged
     in plain text (`Governance/domains/LOGGING_RETENTION.md`).

---

## 3. Access-Request Process

Every request for new access, elevated roles, or scope expansion must follow a
standardized, auditable workflow.

### 3.1 Request Submission

The requester opens an access-request tracking issue or submits a signed request
to the maintainers containing:

- **Identity:** Requester's full name, GitHub handle, and organization affiliation.
- **Access Target:** The specific repository, cloud environment, database, or
  application role requested.
- **Justification:** Clear business and technical rationale detailing why the
  requested permissions are necessary.
- **Scope & Duration:** The specific permissions required and whether the access
  is permanent (role-based) or temporary/time-bound (with stated expiration).
- **Security Attestation:** Confirmation that 2FA/MFA is enabled on the target
  account and that local workstations conform to project security standards.

### 3.2 Approval Matrix

Access requests must receive written approval from the designated authorities
before provisioning:

| Requested Access | Required Approvers | Process Reference |
| --- | --- | --- |
| **Contributor / Triage Access** | Any 1 maintainer | `Governance/roles/CONTRIBUTOR.md` |
| **Repository Maintainer / Write Access** | 2 maintainers acting together | `Governance/roles/MAINTAINER.md` & `Governance/processes/PROMOTION_CRITERIA.md` |
| **Staging Infrastructure / Secrets** | Primary service owner + 1 maintainer | `Governance/domains/SERVICE_OWNERSHIP.md` |
| **Production Cloud / Production DB Access** | Lead maintainer + Security team | `Governance/domains/POSTMORTEM_POLICY.md` |
| **Break-Glass Emergency Access** | Incident commander or on-call maintainer | `Governance/policies/REVOCATION.md` §3 |
| **Custom Application RBAC Role / Grant** | Service owner + RBAC maintainer | `src/rbac/` & `Governance/domains/AUDIT_LOG.md` |

### 3.3 Provisioning & Verification

1. Approvers confirm the request fulfills the least-privilege principle and verify
   that all necessary sign-offs are recorded in the tracking issue.
2. The credential or role is provisioned through infrastructure-as-code or the
   identity provider with the exact scope approved.
3. Where access is temporary, an automated expiry timer is configured at
   provisioning time.
4. All role grants and permission mutations are logged via the audit logging
   service (`AuditAction.ROLE_GRANTED` / `AuditAction.PERMISSION_GRANTED`).

### 3.4 Denials & Appeals

If an access request is rejected, the approver must record the specific
deficiencies in the request thread (e.g. excessive scope, insufficient justification,
or alternative available pathways). The requester may appeal the decision to the
lead maintainer per the appeal procedures in `Governance/policies/REVOCATION.md` §4.

---

## 4. Periodic Review Cadence

Access permissions must not remain static. Privileges naturally accumulate unless
routinely audited and pruned. TeachLink Backend enforces a multi-tier review
cadence:

### 4.1 Cadence Schedule

- **Automated / Continuous:**
  - Automated credential expiration alerts monitor temporary and break-glass
    tokens. Expired tokens are invalidated immediately.
  - Automated inactivity tracking monitors contributor accounts in accordance
    with `Governance/policies/INACTIVITY.md`.
- **Monthly:**
  - Maintainers audit all temporary access grants, active API tokens, and
    third-party integration credentials (`Governance/domains/THIRD_PARTY_INTEGRATION.md`)
    to verify that temporary grants were decommissioned as scheduled.
- **Quarterly:**
  - A formal, comprehensive access review is conducted by the maintainer group:
    1. Repository access lists (owners, maintainers, triage members) are audited
       against current contributor activity.
    2. Infrastructure IAM users, groups, and policies are reconciled against the
       active roster.
    3. Production database access credentials and secrets management permissions
       are re-validated.
    4. Service ownership assignments are reconciled against
       `Governance/domains/SERVICE_OWNERSHIP.md`.
- **Annual:**
  - The security team and lead maintainers conduct a holistic governance review
    of this policy, the application RBAC model (`src/rbac/`), and default
    privilege matrices.
- **Event-Driven / On Offboarding:**
  - When a contributor, reviewer, or maintainer leaves the project or steps down,
    all credentials, repository write permissions, and cloud access are revoked
    within **24 hours** following `Governance/processes/OFFBOARDING.md`.
  - In the event of a security compromise or conduct breach, emergency revocation
    is executed immediately per `Governance/policies/REVOCATION.md`.

### 4.2 Review Outputs & Remediation

Every periodic access review must produce a written summary entry in the
governance records. Any access identified as obsolete, excessive, or unverified
must be revoked within **5 business days** of the review.

---

## 5. Regression Tests Where Applicable

Access control integrity requires continuous validation across both governance
documentation and runtime application controls:

### 5.1 Application Runtime Regression Tests

Application code changes touching authentication, authorization, or role-based
guards must include regression tests that verify both positive access and negative
enforcement:

- **Guard Enforcement:**
  - `RolesGuard` tests (`src/auth/guards/roles.guard.spec.ts`) verify that
    unauthenticated requests throw `UnauthorizedException` and that users
    lacking required roles are denied with `SecurityEventType.PRIVILEGE_ESCALATION`
    security events.
- **RBAC Cache Invalidation:**
  - `RbacCacheService` tests (`src/rbac/rbac-cache.integration.spec.ts`) verify
    that role and permission mutations immediately invalidate cached permissions,
    preventing revoked privileges from persisting.
- **Negative Testing Requirement:**
  - Every endpoint protected by `@Roles()` must have at least one automated
    regression test verifying that an unauthorized or unprivileged role cannot
    access the route (fail-closed requirement).
- **Audit Verification:**
  - Authorization failures and privilege grants must emit matching audit events
    as validated by unit specs in `src/audit-log/`.

### 5.2 Policy & Governance Verification

This policy document is documentation only: it introduces no executable code,
schema migrations, or runtime dependencies, so it adds no unit tests and requires
none. Existing lint, typecheck, build, and test suites must continue to pass
without regression, verified by the standard CI validation pipeline described in
`CONTRIBUTING.md` §10.

---

## 6. Documenting Changes

- **Policy Amendments:**
  - Any proposed changes to this access control governance policy must be submitted
    via a pull request confined to the `Governance/` directory.
  - Substantive changes (such as adjusting approval thresholds, review cadences, or
    scope tiers) require asynchronous review and consensus under
    `Governance/policies/ASYNC_DECISIONS.md`.
- **Decision Log Recording:**
  - Adoption or material modification of this policy is recorded as an immutable
    entry in `Governance/DECISION_LOG.md`.
- **Change Log:**

| Version | Date | Description of Change |
| --- | --- | --- |
| 1.0.0 | 2026-09-25 | Initial Access Control Governance Policy establishing least-privilege principles, access-request process, periodic review cadence, and regression testing standards. |

---

## 7. Related Documents

- [`Governance/README.md`](../README.md) — Governance framework overview and document index.
- [`Governance/policies/REVOCATION.md`](../policies/REVOCATION.md) — Grounds and process for revoking access and privileges.
- [`Governance/policies/INACTIVITY.md`](../policies/INACTIVITY.md) — Inactivity thresholds, notifications, and grace periods.
- [`Governance/roles/MAINTAINER.md`](../roles/MAINTAINER.md) — Maintainer responsibilities and decision authority.
- [`Governance/processes/OFFBOARDING.md`](../processes/OFFBOARDING.md) — Contributor offboarding checklist and access removal.
- [`Governance/processes/PROMOTION_CRITERIA.md`](../processes/PROMOTION_CRITERIA.md) — Criteria for role progression.
- [`Governance/domains/AUDIT_LOG.md`](AUDIT_LOG.md) — Immutability and recording standards for security events.
- [`Governance/domains/SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md) — Ownership mappings and escalation contacts per module.
- [`Governance/domains/CONFIG_CHANGE.md`](CONFIG_CHANGE.md) — Review and parity requirements for configuration and secrets.
- [`Governance/domains/POSTMORTEM_POLICY.md`](POSTMORTEM_POLICY.md) — Post-incident review methodology and break-glass follow-ups.
- [`Governance/DECISION_LOG.md`](../DECISION_LOG.md) — Append-only record of governance decisions.
