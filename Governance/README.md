# TeachLink Backend — Governance

Home for the project's governance documents. Governance documents state **how we
work together**; they are kept separate from `src/` and from the build so that
they never affect application behaviour.

## What belongs here

```
Governance/
├── README.md                              # this file
└── policies/
    └── COMMUNICATION_NORMS.md             # tone, channels, response times
```

A governance document is in scope if it describes contributor or maintainer
behaviour, process, or standards. Anything that changes what the application
_does_ is a code change and belongs in a pull request against `src/`, not here.

## Current documents

| Document                                                             | Version | Status | Covers                                                              |
| -------------------------------------------------------------------- | ------- | ------ | ------------------------------------------------------------------- |
| [`policies/COMMUNICATION_NORMS.md`](policies/COMMUNICATION_NORMS.md) | 1.0.0   | Active | Tone and etiquette · official channels · response-time expectations |

### [`policies/COMMUNICATION_NORMS.md`](policies/COMMUNICATION_NORMS.md)

The versioned reference for how contributors, maintainers, and triagers
communicate. It defines:

- the expected tone and writing conventions, with review etiquette that
  complements the reviewer and author duties in `CONTRIBUTING.md` §9;
- the official channels — GitHub Issues, Pull Requests, Discussions, the
  [Telegram community](https://t.me/teachlinkOD), and private email for
  sensitive reports — and how to choose between them;
- response-time targets per channel and per kind of communication, marked
  explicitly as community norms rather than service-level agreements.

It deliberately does **not** restate contribution mechanics. Branching, commit
format, review criteria, and CI are governed by
[`CONTRIBUTING.md`](../CONTRIBUTING.md), which remains authoritative. Where the
two documents overlap, `CONTRIBUTING.md` wins, and the communication norms say so.

Related operational references it points to, but does not duplicate:
[`docs/RUNBOOKS.md`](../docs/RUNBOOKS.md),
[`docs/ESCALATION_POLICY.md`](../docs/ESCALATION_POLICY.md), and
[`docs/api-security-best-practices.md`](../docs/api-security-best-practices.md).

## Relationship to other documents

| Document                                                    | Owns                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md)                     | How to contribute: branch strategy, commits, PR checklist, review SLA, CI       |
| [`docs/testing-standards.md`](../docs/testing-standards.md) | How to test: unit and E2E standards, mocking, coverage                          |
| `policies/COMMUNICATION_NORMS.md`                           | How to communicate: tone, channels, response times, conduct grounds for removal |

## Change log

Entries are added newest-first. Format: date · version · summary · pull request.

| Date       | Version | Change                                                                                                                                                                         | PR                |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| 2026-09-28 | 1.0.0   | **Initial release.** Added `policies/COMMUNICATION_NORMS.md` and created the `Governance/` tree. Covers tone and etiquette, official channels, and response-time expectations. | This pull request |

### 2026-09-28 — v1.0.0 (initial)

**Added**

- `Governance/policies/COMMUNICATION_NORMS.md` — tone and etiquette (§2),
  official channels (§3), response-time expectations (§4), and enforcement and
  amendment rules (§5).
- `Governance/README.md` — this index.

**Rationale.** The governance set had no versioned reference for community
communication; expected tone, the authoritative channel for each kind of
message, and response-time expectations were undocumented and scattered across
`README.md` and `CONTRIBUTING.md`. Contributors and maintainers had no single
place to look, and no stated baseline for tone.

**Scope.** Self-contained to the `Governance/` folder — two files, no changes
anywhere else in the repository. This was deliberate: it keeps the governance
change auditable and independent of application code.

**Regression tests.** Not applicable. This change is documentation-only: it adds
two Markdown files and modifies no TypeScript, configuration, schema, or
dependency. `Governance/` is outside the Jest root (`jest.config.js` sets
`rootDir: 'src'`), outside the TypeScript build (`tsconfig.build.json`
compiles `src/`), and already covered by the `*.md` exclusion in
`.dockerignore`. No existing test, build step, or runtime path is affected, so
no new test was added and none was modified.

**Verification performed.** Scope confirmed as exactly two new files, both under
`Governance/`; `git diff` against `main` shows no other paths; every relative
link in both documents was checked to resolve on disk; every `CONTRIBUTING.md`
section reference (§1, §2, §8, §9, §13) was checked against the current file;
and the restated review SLA was compared against the table in
`CONTRIBUTING.md` §9 to confirm the two agree.

**Known limitation.** The repository does not currently contain a standalone
Code of Conduct, a `SECURITY.md`, or a governance index outside
`CONTRIBUTING.md`. The communication norms reference the Code of Conduct as it
exists today — the three-line summary in `CONTRIBUTING.md` §1 — and describe
security reporting as `CONTRIBUTING.md` §13 does. If fuller documents are added
later, the cross-references here should be updated to point at them.

## Contributing to governance

Governance documents follow the same contribution mechanics as code: a linked
issue, a branch, and a pull request (`CONTRIBUTING.md` §2). Two additional
expectations:

- **Propose, do not decree.** A change to these norms should arrive as a pull
  request that states the problem it solves. If you are proposing a rule you
  cannot follow, say so — that is useful signal.
- **Keep it short.** A governance document nobody reads has no effect. Prefer
  editing an existing section over adding a new file, and prefer a table row
  over a paragraph.
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
- **Decision-making** — consensus and voting rules, the RFC/proposal process,
  [proposal lifecycle](processes/PROPOSAL_LIFECYCLE.md), and decision records.
- **Community & conduct** — code of conduct, enforcement, moderation, and conflict
  resolution.
- **Contribution governance** — review policy, triage, labels, and roadmap governance.
- **Operations & reliability** — service ownership, on-call, incident response,
  [service-level objectives](domains/SLA_SLO.md), backup, and disaster recovery.
- **Security & disclosure** — vulnerability reporting, embargo, advisory processes, [incident postmortems](domains/POSTMORTEM_POLICY.md), and [access control](domains/ACCESS_CONTROL.md).
- **Releases & change** — versioning, release cadence, deprecation, change policy, and [environment promotion](domains/ENV_PROMOTION.md).
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
- [Transparency Report Policy](policies/TRANSPARENCY_REPORTS.md) — the report
  cadence, the metrics disclosed, and where reports are published.
- [Public Metrics Policy](policies/PUBLIC_METRICS.md) — which metrics the
  scrape endpoints expose, how often they change, and where each metric
  family's data comes from.
- [Changelog Policy](policies/CHANGELOG_POLICY.md) — the required changelog
  format, change categories, and when entries are required.
- [Code Review Policy](policies/REVIEW_POLICY.md) — the requirements that must be
  met before a change is merged, what reviewers check, and the reviewer
  independence rule.
- [Deprecation Policy](policies/DEPRECATION.md) — the deprecation notice
  period, communication channels, and removal criteria, with
  [`domains/API_DEPRECATION.md`](domains/API_DEPRECATION.md) as the
  authoritative policy for API surfaces.

## Processes

Standalone process documents live in `Governance/processes/`:

- [`processes/NOMINATION.md`](processes/NOMINATION.md) — role nomination process.
- [`processes/OFFBOARDING.md`](processes/OFFBOARDING.md) — contributor offboarding checklist and timeline.
- [`processes/PROMOTION_CRITERIA.md`](processes/PROMOTION_CRITERIA.md) — objective promotion criteria per role.
- [`processes/PROPOSAL_LIFECYCLE.md`](processes/PROPOSAL_LIFECYCLE.md) — stages from draft to decision, stage ownership, and exit criteria.
- [`processes/RELEASE_SIGNOFF.md`](processes/RELEASE_SIGNOFF.md) — required release sign-offs, gating checks, and final production release authority.
- [`processes/ESCALATION_PATH.md`](processes/ESCALATION_PATH.md) — incident escalation tiers, role-based contacts, and response SLAs.
- [`processes/WORKING_GROUP_DISSOLUTION.md`](processes/WORKING_GROUP_DISSOLUTION.md) — dissolution triggers, artifact handover, and archival steps for working groups.

## Templates

Reusable templates live in `Governance/templates/`:

- [`templates/AGENDA_TEMPLATE.md`](templates/AGENDA_TEMPLATE.md) — the standard sections,
  time-boxing guidance, and submission process for a governance meeting agenda.
- [`templates/MINUTES_TEMPLATE.md`](templates/MINUTES_TEMPLATE.md) — the structure used to
  record decisions and action items from a meeting.
- [`templates/RFC_TEMPLATE.md`](templates/RFC_TEMPLATE.md) — the starting point for a
  request for comments.
- [`templates/ADR_TEMPLATE.md`](templates/ADR_TEMPLATE.md) — the starting point for an
  architecture decision record.
- [`templates/WORKING_GROUP_CHARTER.md`](templates/WORKING_GROUP_CHARTER.md) — the starting point for a
  working group charter.

## Recognition

- [`RECOGNITION.md`](RECOGNITION.md) — contributor recognition tiers, the criteria
  for each, and the nomination process.

## Contributing to governance

Proposals to add or change governance are made by opening an issue or a pull
request that touches **only** this `Governance/` folder. Keep changes small and
focused (at most two files), and document what changed.

