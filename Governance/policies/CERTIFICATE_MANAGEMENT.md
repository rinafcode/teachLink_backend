# Certificate Management Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers & Security Group (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-27
- **Review cadence:** Quarterly, or immediately after any certificate incident,
  expiry alert, or change to the TLS infrastructure it governs

This document governs the lifecycle of every TLS/SSL certificate used by the
TeachLink Backend project: which certificates are in scope, who owns them, how
they are issued and renewed, how expiry is monitored, and what must happen when
a certificate is revoked or compromised. It exists so that contributors,
maintainers, and operators have one versioned reference rather than re-deriving
certificate handling per incident or per deployment.

This policy is part of the project's **Security & disclosure** and **Operations
& reliability** areas. It lives entirely inside the `Governance/` folder and
does not change application code.

A **certificate** in this document means any X.509 TLS/SSL certificate (and
its associated private key) that secures a connection to or within the
TeachLink Backend platform — including public-facing API endpoints, internal
service-to-service traffic, and CI/CD or infrastructure tooling that presents
or validates a certificate.

---

## 1. Scope

This policy applies to every human and machine identity that requests, stores,
deploys, rotates, or monitors a certificate in the course of working on or
operating TeachLink Backend.

**In scope:**

- Public-facing TLS certificates covering the API hostname(s), the admin
  interface, and any webhook callback URLs the platform registers.
- Internal certificates securing service-to-service communication (for example,
  between the application tier and the database, Redis, or Elasticsearch where
  mutual TLS is in use).
- Certificates used by Kubernetes ingress controllers, Helm chart deployments,
  and any load-balancer or reverse-proxy layer in staging and production.
- Certificates stored in secret providers (`SecretsManagerService` /
  `VaultSecretsService`) and referenced by the application at runtime.
- CI/CD pipeline certificates and any machine-identity certificates used by
  GitHub Actions runners or deployment tooling.

**Out of scope — governed elsewhere but still bound by this policy's
prohibited practices:**

- The private-key *values* of certificates in the secret store. Storage and
  access rules for those values follow
  [`SECRETS_MANAGEMENT.md`](../domains/SECRETS_MANAGEMENT.md); this policy
  governs the certificates themselves.
- End-user client certificates, if any, which are an authentication concern
  governed by [`ACCESS_CONTROL.md`](../domains/ACCESS_CONTROL.md).
- Code-signing certificates, which are outside the TeachLink project's current
  infrastructure boundary.

---

## 2. Certificate Ownership

Clear ownership is the prerequisite for timely renewal, correct incident
response, and audit-trail completeness.

### 2.1 Primary Owner

The **Security Group** (a sub-group of the Maintainers, defined in
[`Governance/roles/MAINTAINER.md`](../roles/MAINTAINER.md)) is the primary
owner of all certificates in scope. The Security Group is responsible for:

- Maintaining the canonical certificate inventory (§3).
- Approving every issuance, renewal, and revocation action.
- Receiving and acting on expiry alerts (§5).
- Signing off on any change to this policy.

### 2.2 Operational Responsibility

Day-to-day certificate operations are carried out by a named **Certificate
Operator** from the Security Group. The Certificate Operator for a given
certificate is recorded in the certificate inventory. Responsibilities include:

- Initiating renewals no later than the lead time in §4.2.
- Confirming successful deployment after each renewal.
- Escalating to the full Security Group when a renewal fails or when a
  revocation is required.

### 2.3 Delegation and Coverage

If the named Certificate Operator is unavailable (for example, due to
absence or offboarding per
[`Governance/processes/OFFBOARDING.md`](../processes/OFFBOARDING.md)), another
member of the Security Group assumes the responsibility. The transition is
recorded in the certificate inventory. No certificate may be in a state where
no active team member is accountable for its renewal.

---

## 3. Certificate Inventory

The Security Group maintains a certificate inventory as a living record. The
inventory is not stored in this document — it is kept in the project's
designated tracking system (the governance issue tracker or a dedicated row in
the secret store metadata, accessible to the Security Group only).

Each inventory record must capture:

| Field | Requirement |
| --- | --- |
| Common Name / SAN | The hostname(s) the certificate covers |
| Certificate Authority | The CA that issued it (e.g. Let's Encrypt, ACM, internal CA) |
| Issuance date | Date the certificate was issued or last renewed |
| Expiry date | The `notAfter` date from the certificate |
| Renewal-due date | Expiry date minus the lead time in §4.2 |
| Certificate Operator | The named operator responsible for this certificate |
| Storage location | Where the certificate and private key are held |
| Automation status | Whether renewal is automated and which tool/mechanism |
| Last verified | Date the certificate and its chain were last manually verified |

The inventory is reviewed as part of the quarterly policy review (§8) and
updated within 24 hours of any issuance, renewal, or revocation.

---

## 4. Issuance and Renewal Rules

### 4.1 Issuance Standards

Every certificate issued for TeachLink Backend must meet all of the following
requirements before being placed into service:

- **Minimum key length.** RSA keys must be at least 2048 bits; ECDSA keys must
  use P-256 or stronger. Weaker keys are prohibited.
- **Signature algorithm.** SHA-256 or stronger. MD5 and SHA-1 are prohibited.
- **Certificate Authority.** Only publicly trusted CAs (for public-facing
  certificates) or a project-approved internal CA (for internal certificates).
  Self-signed certificates are prohibited in staging and production. They may
  be used in local development only, with an explicit note in the developer's
  local `.env` file and never committed.
- **Maximum validity.** New certificates must not be issued with a validity
  period longer than 398 days (approximately 13 months), consistent with
  browser and CA/Browser Forum requirements.
- **Subject Alternative Names.** Certificates must use SANs; the Common Name
  field alone is not sufficient for any new issuance.
- **Private key generation.** The private key is generated in the environment
  where it will be used and is never transmitted over a network in plain text.
  Key material is never committed to source control.
- **Chain completeness.** The full certificate chain (leaf plus intermediates)
  must be deployed together. A certificate whose chain is incomplete is not
  considered valid for deployment.

### 4.2 Renewal Lead Times and Cadence

| Certificate type | Maximum validity | Renewal initiated by | Renewal lead time |
| --- | --- | --- | --- |
| Public-facing (Let's Encrypt / ACME) | 90 days | Automated (ACME client) | ≥ 30 days before expiry |
| Public-facing (CA-issued, manual) | 398 days | Certificate Operator | ≥ 60 days before expiry |
| Internal / service-to-service | 398 days | Certificate Operator | ≥ 60 days before expiry |
| CI/CD and infrastructure tooling | 398 days | Certificate Operator | ≥ 60 days before expiry |

Rules that apply to every renewal:

- **Automation-first.** Where the CA and infrastructure support ACME or another
  automated renewal protocol (for example, cert-manager in Kubernetes), automated
  renewal is mandatory. Manual renewal is a fallback for CAs or environments where
  automation is not available, not a preference.
- **Staging before production.** A renewed certificate is deployed to staging and
  verified (§4.3) before being deployed to production. A renewal that fails in
  staging is fixed there first.
- **No expired certificates.** A certificate that has passed its expiry date must
  not serve traffic under any circumstances — even briefly, for convenience, or
  pending a renewal that is in progress. An expiry is treated as a certificate
  incident (§6).
- **Old certificate kept briefly.** After a successful renewal, the previous
  certificate and key pair are retained in the secret store for 7 days (to support
  any rollback) and then deleted. They are never left active beyond the rollback
  window.

### 4.3 Post-Renewal Verification

After every renewal and before removing the old certificate:

1. Confirm the new certificate is being served on all affected endpoints using
   an external check (for example, `openssl s_client`, a monitoring probe, or an
   online TLS checker).
2. Confirm the full chain is present and trusted by a standard client.
3. Confirm the `notAfter` date in the new certificate matches the expected
   validity window.
4. For automated renewals, confirm the automation tool's own success log or
   status indicator.
5. Update the certificate inventory (§3) with the new issuance date, expiry
   date, renewal-due date, and "last verified" date.
6. Record the renewal in the governance decision record or the relevant
   operational run-book, including: the operator, the date, the certificate
   (identified by CN/SAN), and the verification result.

---

## 5. Expiry Monitoring

Undetected expiry is the most common certificate failure mode. This section
defines the monitoring controls that prevent it.

### 5.1 Automated Alerting Thresholds

The following alert thresholds are the minimum required. Alerts must reach the
Security Group via the project's primary on-call channel
([`Governance/domains/ON_CALL.md`](../domains/ON_CALL.md)):

| Days until expiry | Alert type | Required action |
| --- | --- | --- |
| 60 days | Warning | Certificate Operator reviews and confirms renewal is scheduled or in progress |
| 30 days | Warning (escalated) | Renewal must be initiated immediately if not already underway |
| 14 days | Critical | Security Group is notified; renewal is treated as urgent; on-call is engaged |
| 7 days | Critical (all-hands) | All Security Group members are notified; incident process (§6) is opened |
| 0 days (expiry reached) | Incident | Treated as a certificate incident; all-hands response |

### 5.2 Monitoring Mechanism

- **External probe.** At a minimum, a scheduled external TLS check (for example,
  a cron-driven `openssl s_client` probe or a monitoring service) runs at least
  every 24 hours against every in-scope hostname and reports the days-until-expiry
  metric. This check is governed as a scheduled job under
  [`Governance/domains/CRON_GOVERNANCE.md`](../domains/CRON_GOVERNANCE.md).
- **Secret-store metadata.** Where the certificate is stored in the secret store,
  the expiry date is recorded as metadata and queried by the monitoring probe in
  addition to (not instead of) the live TLS check.
- **CI gate.** The CI/CD pipeline includes a certificate-expiry check as a
  non-blocking advisory step that logs days-until-expiry for every configured
  hostname. A certificate within 30 days of expiry produces a pipeline warning.
- **Inventory review.** The certificate inventory (§3) is reviewed at each
  quarterly policy review; certificates approaching their renewal-due date are
  flagged for immediate action.

### 5.3 Monitoring Ownership

The Certificate Operator named in the inventory is responsible for acting on
monitoring alerts within the response time specified in the table above. If no
action is taken within the response window, the alert automatically escalates to
the full Security Group and is recorded as a governance issue.

---

## 6. Revocation and Certificate Incidents

### 6.1 Grounds for Revocation

A certificate must be revoked immediately when:

- The associated private key is known or suspected to have been exposed
  (committed to source control, logged, transmitted in plain text, or accessed
  without authorisation).
- The certificate is no longer needed (decommissioned hostname, retired service).
- The certificate was issued with incorrect information (wrong SAN, wrong key
  length, wrong CA).
- The issuing CA revokes the certificate or announces a mis-issuance.
- A regulatory or legal requirement mandates revocation.

### 6.2 Revocation Process

1. The Certificate Operator or any Security Group member who discovers a
   revocation trigger notifies the full Security Group immediately.
2. The certificate is revoked at the CA (using the CA's revocation mechanism or
   OCSP/CRL) as soon as practicable — within 24 hours for key compromise, within
   7 days for other grounds.
3. A replacement certificate is issued following §4.1 and deployed to all
   affected environments.
4. The private key associated with the revoked certificate is deleted from all
   storage locations.
5. The certificate inventory is updated to record the revocation date, ground,
   and replacement.
6. If the revocation ground is key compromise, the event is handled as a security
   incident under `src/incident-management/` and recorded through the audit log
   (`src/audit-log/`, `AuditAction.CONFIG_CHANGED` or a security event as
   appropriate), following
   [`Governance/domains/AUDIT_LOG.md`](../domains/AUDIT_LOG.md).

### 6.3 Prohibited Practices

The following are prohibited without exception:

1. **Committing private key material to source control** — in any branch,
   commit, or tag, including temporary or experimental branches. A committed key
   is treated as compromised and must be revoked immediately.
2. **Using an expired certificate in staging or production** — even briefly or
   as a placeholder.
3. **Using a self-signed certificate in staging or production.**
4. **Sharing a private key between environments** — each environment holds its
   own key pair.
5. **Storing a private key unencrypted outside the approved secret store.**
6. **Transmitting a private key over an unencrypted channel or in plain text.**
7. **Suppressing or acknowledging-away an expiry alert without acting on it.**
8. **Bypassing the staging-before-production requirement** — even in an
   emergency; if staging is unavailable the situation is treated as an incident.

---

## 7. Regression Tests Where Applicable

This document is a governance-only, documentation-only change. It introduces no
runtime behaviour, no schema change, and no executable code, so it adds no tests
and requires none. Existing lint, typecheck, build, and test suites must continue
to pass, verified by the `validate` job in `.github/workflows/ci.yml` described
in `CONTRIBUTING.md`.

When a future code change touches certificate loading, TLS configuration, or
certificate-expiry probing, that change ships with tests that enforce this
policy, including:

- **Chain validation** — a unit or integration test asserting that the
  application rejects connections backed by an incomplete or untrusted chain,
  covering the TLS configuration in the relevant server bootstrap or Kubernetes
  ingress configuration.
- **Expiry probe** — a unit test for any scheduled certificate-expiry check,
  asserting that it correctly computes days-until-expiry and emits an alert at
  the thresholds in §5.1.
- **Fail-closed on missing certificate** — a test asserting that a missing or
  invalid certificate path fails the application boot rather than degrading to
  plain HTTP.
- **Key material not logged** — coverage that private key material does not
  appear in application logs or error responses, exercised through
  `src/logging/sensitive-data.masker.spec.ts`.

---

## 8. Review

This policy is reviewed quarterly and immediately after any certificate
incident, expiry event, CA advisory, or change to the TLS infrastructure it
governs. Changes are proposed through the normal governance process described in
[`Governance/README.md`](../README.md) and must touch only the `Governance/`
folder.

---

## 9. Related Documents

- [`Governance/domains/SECRETS_MANAGEMENT.md`](../domains/SECRETS_MANAGEMENT.md)
  — storage, access, and rotation rules for the private keys associated with
  certificates.
- [`Governance/domains/ACCESS_CONTROL.md`](../domains/ACCESS_CONTROL.md)
  — least-privilege and access-request rules governing who may access
  certificate and key material.
- [`Governance/domains/AUDIT_LOG.md`](../domains/AUDIT_LOG.md) — audit
  recording for certificate issuance, renewal, and revocation events.
- [`Governance/domains/ON_CALL.md`](../domains/ON_CALL.md) — on-call
  responsibilities and escalation path for certificate expiry alerts.
- [`Governance/domains/CRON_GOVERNANCE.md`](../domains/CRON_GOVERNANCE.md)
  — governance requirements for the scheduled certificate-expiry monitoring job.
- [`Governance/domains/SERVICE_OWNERSHIP.md`](../domains/SERVICE_OWNERSHIP.md)
  — the owner and area reviewer for any TLS or certificate surface being changed.
- [`Governance/processes/OFFBOARDING.md`](../processes/OFFBOARDING.md)
  — access removal when a Certificate Operator leaves the project.
- [`Governance/policies/REVOCATION.md`](REVOCATION.md) — grounds and process
  for revoking contributor privileges; referenced for the off-boarding trigger.
- [`Governance/README.md`](../README.md) — the governance structure this
  document belongs to.

---

## 10. Change Log

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-09-27 | Initial Certificate Management Policy — issuance standards, ownership, renewal lead times, expiry monitoring thresholds, revocation process, prohibited practices, and regression-test requirements. |
