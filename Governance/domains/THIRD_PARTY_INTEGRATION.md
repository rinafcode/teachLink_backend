# Third-Party Integration Policy

This document governs how third-party services, libraries, APIs, and hosted
integrations are proposed, vetted, and maintained in the TeachLink Backend
project. It exists so that every external dependency added to the platform
carries a clear, versioned record of why it was adopted and how it is kept
safe over time.

This policy is part of the project's **Security & disclosure** and
**Contribution governance** areas. It lives entirely inside the `Governance/`
folder and does not change application code.

## Scope

A third-party integration is any of the following:

- A hosted service the backend calls at runtime (payment providers, email or
  SMS gateways, storage buckets, analytics, on-chain RPC endpoints).
- A software dependency added to `package.json` that reaches the network or
  handles user data.
- A webhook or callback that grants an external system write access to
  TeachLink data.

Purely local development tooling that never runs in production and never
touches user data is out of scope.

## Vetting Checklist

Every proposed integration must be recorded in the issue that requests it and
must satisfy all items below before it is merged.

- [ ] **Ownership.** A named maintainer is assigned as the owner of the
  integration and is responsible for its lifecycle.
- [ ] **Purpose.** The issue states the concrete capability the integration
  provides and why an in-house alternative is not preferred.
- [ ] **License.** The provider's terms and the dependency license are
  compatible with the project license and are recorded in the issue.
- [ ] **Security posture.** The provider supports encrypted transport, and any
  credentials are stored as secrets, never in source control.
- [ ] **Data footprint.** The exact fields shared with the provider are listed
  and justified against the data-sharing limits below.
- [ ] **Failure behaviour.** The integration degrades safely when the provider
  is unavailable and does not block core learning flows.
- [ ] **Maintenance signal.** The dependency is actively maintained, with a
  recent release and a responsive security channel.

## Data-Sharing Limits

Integrations are held to data minimisation. The following limits apply to
every integration in scope.

- Share only the fields required for the integration to function. Bulk exports
  of user records are prohibited without an explicit, issue-tracked approval.
- Never share credentials, password hashes, private keys, or full wallet seed
  material with any external provider.
- Personally identifiable information may leave the platform only when the
  provider has a signed data-processing agreement recorded by a maintainer.
- Pseudonymise or hash identifiers wherever the provider does not strictly need
  the raw value.
- Configure the shortest retention the provider allows, and prefer providers
  that support deletion on request.
- Route all outbound calls over encrypted transport, and reject providers that
  cannot offer it.

## Review Cadence

Integrations are reviewed on a fixed schedule so that the policy stays enforced
after adoption.

- **Quarterly.** The integration owner confirms the provider is still in use,
  still maintained, and still within its declared data footprint.
- **On dependency alert.** A security advisory against an integrated dependency
  triggers an immediate review by the owner, ahead of the quarterly cycle.
- **On scope change.** Any change to the fields shared or the capability used
  requires a new vetting pass against the checklist above.
- **Annually.** Maintainers review the full register of integrations and retire
  any that are unused or unmaintained.

Each review is recorded as a comment on the tracking issue for the integration
so the history stays versioned alongside the rest of governance.
