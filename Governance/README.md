# Governance

This folder holds the **governance** of this TeachLink repository: the documents,
policies, roles, and processes that define how the project is run, how decisions
are made, and how contributors participate.

Everything in `Governance/` is documentation and policy. It is self-contained:
changes to governance are made **only** inside this folder and do not affect
application code.

## Purpose

- Make the project's decision-making transparent and predictable.
- Define clear roles, responsibilities, and expectations for contributors and maintainers.
- Give the community a single, versioned home for policies (contribution, conduct,
  security disclosure, releases, licensing, and on-chain/community governance).

## Structure

The governance documents are organised into the following areas. Individual
documents are added and refined over time (tracked as issues):

- **Foundations** — charter, mission, values, principles, and glossary.
- **Roles & membership** — contributor ladder, maintainer/reviewer roles, and the
  onboarding/offboarding lifecycle, including
  [working group dissolution](processes/WORKING_GROUP_DISSOLUTION.md).
- **Decision-making** — consensus and voting rules, the RFC/proposal process, and
  decision records.
- **Community & conduct** — code of conduct, enforcement, moderation, and conflict
  resolution.
- **Contribution governance** — review policy, triage, labels, and roadmap governance.
- **Security & disclosure** — vulnerability reporting, embargo, advisory processes, and [incident postmortems](domains/POSTMORTEM_POLICY.md).
- **Releases & change** — versioning, release cadence, deprecation, and change policy.
- **Legal & IP** — licensing, contributor sign-off, trademark, and attribution.
- **Community & on-chain governance** — treasury, grants, and proposal governance.

## Policies

Standalone policies live in `Governance/policies/`:

- [`policies/INACTIVITY.md`](policies/INACTIVITY.md) — inactivity thresholds per
  role, the notification process, consequences, and the reinstatement path.
  Versioned policies live in [`Governance/policies/`](policies/):

- [Privilege Revocation Policy](policies/REVOCATION.md) — grounds for revoking
  privileges, who can initiate revocation, and the appeal path.
- [Voting Quorum Policy](policies/QUORUM.md) — the quorum threshold for a
  formal vote, how quorum is measured, and what happens when it is not met.
- [Supermajority Policy](policies/SUPERMAJORITY.md) — which decisions require
  a supermajority, the two-thirds threshold, and how it is calculated.
- [Asynchronous Decision Policy](policies/ASYNC_DECISIONS.md) — when a decision
  may be taken asynchronously, the minimum response window, and the recording
  requirement.
- [Public Metrics Policy](policies/PUBLIC_METRICS.md) — which metrics the
  scrape endpoints expose, how often they change, and where each metric
  family's data comes from.

## Processes

Standalone process documents live in `Governance/processes/`:

- [`processes/NOMINATION.md`](processes/NOMINATION.md) — role nomination process.
- [`processes/OFFBOARDING.md`](processes/OFFBOARDING.md) — contributor offboarding checklist and timeline.
- [`processes/PROMOTION_CRITERIA.md`](processes/PROMOTION_CRITERIA.md) — objective promotion criteria per role.
- [`processes/WORKING_GROUP_DISSOLUTION.md`](processes/WORKING_GROUP_DISSOLUTION.md) — dissolution triggers, artifact handover, and archival steps for working groups.

## Contributing to governance

Proposals to add or change governance are made by opening an issue or a pull
request that touches **only** this `Governance/` folder. Keep changes small and
focused (at most two files), and document what changed.

