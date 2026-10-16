# Vendor Risk Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-10-16
- **Review cadence:** Every 6 months, or immediately after any Tier 1 vendor incident

This policy defines how TeachLink Backend assesses, classifies, and monitors
the risk posed by external vendors — including hosted services, API providers,
payment processors, infrastructure suppliers, and any other third party on
which the platform depends at runtime.

It exists so that vendor risk is evaluated consistently before adoption,
classified clearly by impact, and revisited on a known schedule rather than
only when something goes wrong.

"Vendor" means any external organisation or individual whose service,
software, or infrastructure the platform relies on to function. This policy
complements the [Third-Party Integration Policy](../domains/THIRD_PARTY_INTEGRATION.md),
which governs the technical vetting checklist; this policy governs the
*risk posture* that determines how much scrutiny each vendor receives.

This document is governance only. It does not change application behaviour and
is scoped entirely to the `Governance/` folder.

## 1. Vetting Criteria

Every vendor must be assessed against the following criteria before it is
formally adopted, and reassessed whenever it moves between risk tiers (§2).

### 1.1 Security posture

| Criterion | Requirement |
| --- | --- |
| Encrypted transport | All API communication uses TLS 1.2 or later; no plaintext fallback. |
| Credential handling | API keys and tokens are stored as project secrets; never in source control. |
| Incident disclosure | The vendor has a public security advisory channel or a responsible-disclosure programme. |
| Compliance certifications | Tier 1 and Tier 2 vendors must hold at least one relevant certification (SOC 2 Type II, ISO 27001, PCI DSS, or equivalent). |

### 1.2 Data handling

| Criterion | Requirement |
| --- | --- |
| Data minimisation | Only the fields required for the service to function are shared; bulk user-data exports are prohibited without a tracked approval. |
| Data-processing agreement | Vendors that receive personally identifiable information must have a signed DPA on file before the integration is enabled in production. |
| Retention limits | The shortest available retention setting must be configured; prefer vendors that support deletion on request. |
| Geographic constraints | Vendors that store data outside the jurisdictions permitted by the platform's compliance posture require an explicit maintainer approval. |

### 1.3 Operational reliability

| Criterion | Requirement |
| --- | --- |
| SLA | Tier 1 vendors must publish an SLA with a target uptime of ≥ 99.9 %; Tier 2 vendors must publish any SLA. |
| Status page | The vendor provides a public or authenticated status page that can be used for incident monitoring. |
| Failure isolation | The integration degrades safely when the vendor is unavailable and does not block core learning flows. |

### 1.4 Business continuity

| Criterion | Requirement |
| --- | --- |
| Active maintenance | The vendor (or the open-source project) shows signs of active maintenance: recent releases, a responsive issue tracker, or a public roadmap. |
| Exit path | A migration or fallback path exists in the event the vendor discontinues the service or becomes unacceptable. |
| Concentration risk | Adding the vendor must not create a single point of failure across more than one critical platform capability without documented mitigation. |

### 1.5 Legal and licensing

| Criterion | Requirement |
| --- | --- |
| License compatibility | The vendor's terms and any dependency license are compatible with the project license and are recorded in the adoption issue. |
| Jurisdiction | Applicable data-sovereignty and export-control rules are reviewed and documented before adoption. |

## 2. Risk Tiers

All vendors in scope are assigned one of three risk tiers. The tier determines
the depth of initial vetting (§1), the review cadence (§3), and the escalation
path when issues arise.

| Tier | Label | Description | Examples |
| --- | --- | --- | --- |
| **1** | Critical | Vendors whose unavailability or compromise would directly interrupt core platform operations or expose sensitive user data at scale. | Payment processors (Stripe), primary authentication providers, database hosting, primary cloud infrastructure. |
| **2** | Significant | Vendors that affect platform quality or a specific feature area but whose failure can be tolerated by core flows or mitigated with a known fallback. | Email delivery (SendGrid), file storage (Cloudinary / S3), search (Elasticsearch), real-time messaging infrastructure. |
| **3** | Standard | Vendors with limited blast radius: used in non-critical paths, optional features, or internal tooling, and can be replaced with low disruption. | Analytics and telemetry collectors, error-reporting tools, documentation hosting, development-only services. |

### 2.1 Tier assignment

A vendor's initial tier is proposed by the maintainer requesting the
integration and confirmed by the reviewing maintainer. The assignment must be
recorded in the integration's tracking issue.

Tier assignment is driven by the answers to the following questions:

1. **Data sensitivity** — does the vendor receive PII, credentials, or financial data?
   PII or financial data → at least Tier 2; credentials or payment-card data → Tier 1.
2. **Failure impact** — if the vendor is unavailable, do core user flows (login,
   course access, payments) degrade?
   Any core flow affected → at least Tier 2; multiple core flows affected → Tier 1.
3. **Data volume** — does the vendor receive data on behalf of all platform users
   or only a subset?
   All users → at least Tier 2; all users and sensitive data → Tier 1.
4. **Reversibility** — how long would it take to migrate away from this vendor
   in an emergency?
   More than one week → at least Tier 2; more than one month → Tier 1.

A vendor meets the tier whose criteria it satisfies at the *highest* level.

### 2.2 Tier promotion and demotion

A vendor's tier is reviewed whenever:

- Its scope changes (new data types are shared or new platform features rely on it).
- A security incident is disclosed that affects any customer of the vendor.
- Maintainers identify a change in failure impact during a scheduled review (§3).

Tier changes are recorded in the tracking issue and take effect at the next
scheduled review cycle unless a security concern requires immediate action.

## 3. Review Cadence

| Tier | Scheduled review | Trigger-based review |
| --- | --- | --- |
| **1 – Critical** | Every 3 months | Immediately on any security advisory, incident, or contract change. |
| **2 – Significant** | Every 6 months | On any security advisory affecting the vendor, or on a scope change. |
| **3 – Standard** | Annually | On any security advisory affecting the vendor. |

Each review must confirm:

1. The vendor is still in active use and still meets the vetting criteria for
   its tier (§1).
2. The data footprint has not grown beyond what was declared at adoption.
3. No new security advisories or compliance issues have been identified.
4. The vendor's tier classification remains appropriate.

The outcome of each review is recorded as a comment on the vendor's tracking
issue. If the review identifies a deficiency, the integration owner opens a
remediation issue and targets resolution within the period defined in §4.

## 4. Remediation and Escalation

| Severity | Definition | Resolution target |
| --- | --- | --- |
| **Critical** | Active credential compromise, confirmed data breach, or regulatory prohibition. | Immediate suspension of the integration; resolution or removal within 24 hours. |
| **High** | Security advisory with a known exploit, contract violation, or sustained SLA failure. | Remediation plan within 48 hours; resolution within 7 days. |
| **Medium** | Lapsed certification, minor data-footprint creep, or tier criteria no longer fully met. | Tracked remediation issue; resolved before the next scheduled review. |
| **Low** | Documentation gap, missing review record, or out-of-date tier assignment. | Corrected at the next scheduled review. |

Escalation beyond the integration owner follows the standard maintainer
escalation path. A Critical or High severity issue for a Tier 1 vendor must
be communicated to the Lead Maintainer within one hour of identification.

## 5. Vendor Register

A register of all in-scope vendors is maintained in the governance tracking
system (issues labelled `governance/vendor`). Each entry records:

- Vendor name, service type, and the issue where it was adopted.
- Assigned risk tier and the date of the last tier review.
- Integration owner (named maintainer).
- Date and outcome of the most recent scheduled review.
- Any open remediation issues.

The register is reviewed in full as part of every Tier 1 scheduled review and
at least annually for lower tiers.

## 6. Relationship to Other Policies

- **Third-Party Integration Policy** (`Governance/domains/THIRD_PARTY_INTEGRATION.md`)
  — governs the technical vetting checklist applied before adoption. This policy
  governs the ongoing risk classification and review cycle. Both must be satisfied
  for an integration to be considered fully approved.
- **Privilege Revocation Policy** (`Governance/policies/REVOCATION.md`) — a vendor
  incident that results in credential compromise may trigger revocation of the
  affected service's access tokens under that policy.
- **Security & disclosure policy** — vendor security advisories are processed
  through the same disclosure and response channels used for the platform itself.

Where this policy and another governance document conflict, the more specific
document prevails for its subject matter, and the conflict is recorded as a
governance issue.

## 7. Change Log

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-10-16 | Initial vendor risk policy: vetting criteria, risk tiers, review cadence, remediation levels, and vendor register. |
