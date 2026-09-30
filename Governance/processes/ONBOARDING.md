# Contributor Onboarding

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers (see [Roles & membership](../README.md#structure))
- **Last reviewed:** 2026-09-30
- **Review cadence:** Every 6 months, or after a material change to the contribution process

This document defines how a new contributor is brought into TeachLink Backend: the
steps they follow, the resources they receive, and who is accountable for each
step. It closes the gap left by the missing onboarding half of the contributor
lifecycle — the offboarding procedure already exists at
[`OFFBOARDING.md`](OFFBOARDING.md).

This document is a governance procedure. It lives entirely inside the
`Governance/` folder and does not change application code.

**It does not restate contribution mechanics.** Branching, commit format, pull
request requirements, review SLA, and CI remain authoritative in
[`CONTRIBUTING.md`](../../CONTRIBUTING.md). Where this document and
`CONTRIBUTING.md` overlap, `CONTRIBUTING.md` wins.

---

## 1. Purpose

A new contributor should be able to go from "I would like to help" to "my first
pull request is merged" using one versioned, auditable path, without needing
private knowledge of an individual maintainer. This process makes that path
explicit so that:

- the expected first steps are discoverable before anyone asks;
- the resources needed to run the project locally are named in one place;
- ownership of onboarding is unambiguous, so a stalled onboarding is visible
  rather than silent;
- the first contribution is subject to the same quality gates and review as
  every other contribution — onboarding is a support path, never a bypass.

## 2. Scope

**Applies to** anyone who has not yet had a pull request merged into TeachLink
Backend, including first-time contributors, returning contributors rejoining
after inactivity, and contributors picking up a different kind of work
(documentation, tests, tooling, or code).

**Covers** the path from a claimed issue through a merged first pull request:
orientation, environment setup, contribution mechanics, and what a contributor
has access to afterwards.

**Does not cover:**

- Privileged or production access (cloud environments, production databases,
  secrets, on-call rotation). These follow the request, approval, and
  provisioning procedure in
  [`domains/ACCESS_CONTROL.md`](../domains/ACCESS_CONTROL.md) §3 and are never
  granted as part of onboarding.
- Security-sensitive or conduct-related work, which follows its own specialist
  process.
- The ongoing contributor lifecycle after the first merge, which is covered by
  [`roles/CONTRIBUTOR.md`](../roles/CONTRIBUTOR.md),
  [`processes/PROMOTION_CRITERIA.md`](PROMOTION_CRITERIA.md), and
  [`policies/INACTIVITY.md`](../policies/INACTIVITY.md).
- Departure from the project, which is covered by
  [`OFFBOARDING.md`](OFFBOARDING.md).

## 3. Ownership

**The maintainer team owns onboarding.** Under
[`roles/MAINTAINER.md`](../roles/MAINTAINER.md), maintainers are responsible
for maintaining governance, which includes the contributor lifecycle. This
document is owned by the maintainers and changes through a pull request limited
to the `Governance/` folder.

| Party           | Responsibility                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maintainer team | Owns this process; keeps the good-first-issue pool stocked; assigns buddies; ensures first contributions are reviewed and merged.                                                   |
| Assigned buddy  | A maintainer or experienced contributor who walks the new contributor through the phases, answers setup and design questions, and gives actionable early feedback. Not an approver. |
| New contributor | Claims an issue, follows the documented steps, runs the checks, and responds to review feedback. Remains responsible for their own setup.                                           |
| Lead maintainer | Escalation point when onboarding stalls, a buddy must be replaced, or a scope dispute cannot be resolved by the maintainer team.                                                    |

Ownership rules:

- **A buddy is assigned, not assumed.** The maintainer team names a buddy when an
  issue is assigned. A buddy may hand the task back to the maintainer team when
  it needs domain authority, privileged access, or more time than a first
  contribution should require.
- **A buddy is support, not authority.** Only an authorised maintainer can
  approve and merge a pull request
  ([`policies/FIRST_TIME_CONTRIBUTOR.md`](../policies/FIRST_TIME_CONTRIBUTOR.md)
  §5). The buddy must never request passwords, private keys, tokens, or access
  to a contributor's personal accounts.
- **Declining a buddy is allowed.** A contributor may ask for a different buddy
  or continue without one. Requesting help — or declining it — must never affect
  review priority or eligibility.
- **Discussion stays public.** Questions are asked in the issue or pull request.
  Private channels are used only for sensitive security reports, which follow
  [`SECURITY_POLICY.md`](../SECURITY_POLICY.md).

## 4. Onboarding Steps

The phases are ordered but not time-boxed. A contributor working on a
documentation or test-only change may skip parts of Phase 1 that their change
does not exercise; a contributor changing application code completes all of them.

### Phase 0 — Orientation (before the first pull request)

1. Read [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — at minimum §1 (Code of
   Conduct), §2 (Before You Start), §3 (Branch Strategy), and §8 (Pull Request
   Requirements).
2. Read the project [Code of Conduct](../CODE_OF_CONDUCT.md) and the
   [Communication Norms](../policies/COMMUNICATION_NORMS.md) for how the project
   expects people to work together.
3. Enable multi-factor authentication on the contributor's GitHub account
   ([`domains/ACCESS_CONTROL.md`](../domains/ACCESS_CONTROL.md) §2.6).
4. Search the open issues and pick a task. Issues labelled `good first issue` are
   reserved for new contributors under
   [`policies/GOOD_FIRST_ISSUE.md`](../policies/GOOD_FIRST_ISSUE.md).
5. Comment on the issue to claim it. A maintainer assigns it and names a buddy
   (§3). **A pull request without a linked, claimed issue is not reviewed**
   (`CONTRIBUTING.md` §2).

### Phase 1 — Local Environment

6. Install the prerequisites listed in `CONTRIBUTING.md` §5: Node.js 20 LTS,
   npm 10+, PostgreSQL 15+, Redis 7+, and Docker 24+ (optional).
7. Clone the repository, run `npm ci`, and create `.env` from `.env.example`.
   Never commit real credentials; secrets follow
   [`domains/SECRETS_MANAGEMENT.md`](../domains/SECRETS_MANAGEMENT.md).
8. Start PostgreSQL and Redis, then create the database and run migrations, as
   described in [`docs/setup.md`](../../docs/setup.md).
9. Verify the server starts and the health check responds, and confirm the
   generated API documentation loads (`docs/setup.md` Steps 8–9).
10. Run the four quality gates. All must exit `0` before a pull request is
    accepted:

    ```bash
    npm run lint:ci         # ESLint — zero warnings allowed
    npm run format:check    # Prettier — must pass with no changes
    npm run typecheck       # TypeScript — zero type errors
    npm run test:ci         # Unit tests + coverage
    ```

11. Know how to get help: GitHub Issues for defects and tracking, GitHub
    Discussions for architecture questions, the community channel for quick
    questions, and direct maintainer contact for security reports
    (`CONTRIBUTING.md` §13).

### Phase 2 — First Contribution

12. Create a branch from `develop` following the naming convention in
    `CONTRIBUTING.md` §3.
13. Write the change with appropriate tests, following
    [`docs/testing-standards.md`](../../docs/testing-standards.md). A
    documentation-only or `Governance/`-only change still passes the gates that
    apply to it, and never needs a test to satisfy a gate.
14. Commit using the Conventional Commits format required by `CONTRIBUTING.md`
    §7, and re-run the four gates locally.
15. Open the pull request against `develop` and complete the pull request
    template in full (`CONTRIBUTING.md` §8).
16. Respond to every review comment, distinguishing blocking requirements from
    optional suggestions. Only a maintainer merges
    (`CONTRIBUTING.md` §9 and §11).

### Phase 3 — After the First Merge

17. A merged pull request makes the author a contributor
    ([`roles/CONTRIBUTOR.md`](../roles/CONTRIBUTOR.md)). At this point the
    contributor is subject to the project's expectations rather than the
    onboarding support path.
18. Optionally claim recognition under
    [`RECOGNITION.md`](../RECOGNITION.md), which credits mentoring and helping
    other contributors.
19. Progression to reviewer, triager, committer, or maintainer follows
    [`processes/PROMOTION_CRITERIA.md`](PROMOTION_CRITERIA.md). Progression is
    never part of onboarding and is never automatic.

## 5. Resources Provided

A new contributor receives access to the following. Everything in this table is
already in the repository; onboarding does not create new material, it points at
it.

| Resource                                                                          | Purpose                                                                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`CONTRIBUTING.md`](../../CONTRIBUTING.md)                                        | Authoritative contribution mechanics: branch strategy, commits, PR requirements, review SLA, CI, merge. |
| [`docs/setup.md`](../../docs/setup.md)                                            | Step-by-step local setup, prerequisites, migrations, and test commands.                                 |
| [`.env.example`](../../.env.example)                                              | The configuration contract; the template a contributor copies for their own `.env`.                     |
| [`docs/testing-standards.md`](../../docs/testing-standards.md)                    | How to write unit and e2e tests, mocking rules, and coverage expectations.                              |
| [`openapi-spec.json`](../../openapi-spec.json) and [`docs/api/`](../../docs/api/) | The API surface, so a contributor can find endpoints without reading the whole source.                  |
| [`README.md`](../../README.md) architecture and tech-stack sections               | Module layout, technology choices, and how the pieces fit together.                                     |
| [`docs/RUNBOOKS.md`](../../docs/RUNBOOKS.md)                                      | Operational runbooks, for contributors touching runtime or deployment behaviour.                        |
| [`docs/troubleshooting.md`](../../docs/troubleshooting.md)                        | Known local-development problems and their fixes.                                                       |
| CODEOWNERS, as documented in `CONTRIBUTING.md` §9                                 | Which maintainer reviews which module, and who to ask about a specific area.                            |
| [`policies/FIRST_TIME_CONTRIBUTOR.md`](../policies/FIRST_TIME_CONTRIBUTOR.md)     | The support a first-time contributor can expect, and the mentorship rules.                              |
| [`policies/GOOD_FIRST_ISSUE.md`](../policies/GOOD_FIRST_ISSUE.md)                 | What makes a task suitable as a first contribution.                                                     |
| [`policies/COMMUNICATION_NORMS.md`](../policies/COMMUNICATION_NORMS.md)           | Tone, official channels, and response-time expectations.                                                |
| [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md)                                     | The conduct expected of every participant.                                                              |
| [`SECURITY_POLICY.md`](../SECURITY_POLICY.md)                                     | How to report a vulnerability privately, and what happens next.                                         |
| [`roles/CONTRIBUTOR.md`](../roles/CONTRIBUTOR.md)                                 | What the contributor role grants and expects after the first merge.                                     |
| [`OFFBOARDING.md`](OFFBOARDING.md)                                                | The other half of the lifecycle, so the contributor knows what happens at the end.                      |

Resources are public to the repository. Onboarding grants **no** additional
access, credentials, or permissions; anything beyond read access to the
repository follows the access-request procedure in
[`domains/ACCESS_CONTROL.md`](../domains/ACCESS_CONTROL.md) §3.

## 6. Expected Timelines

These are community norms for support responsiveness, not service-level
agreements, and they are not approval guarantees.

| Step                                      | Expectation                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| Buddy acknowledges a claimed issue        | Within three business days (`policies/FIRST_TIME_CONTRIBUTOR.md` §3).              |
| Maintainer reviews a first pull request   | Per the review SLA in `CONTRIBUTING.md` §9.                                        |
| Phases 1 and 2 (setup and implementation) | Self-paced, by the contributor. No deadline; the project has no onboarding sprint. |
| Escalation to the lead maintainer         | When a buddy is unresponsive, must be replaced, or a scope dispute is unresolved.  |

If any step stalls beyond these targets, the contributor may ask for a different
buddy, continue without one, or escalate — and doing so must never affect review
priority or eligibility.

## 7. Regression Tests Where Applicable

**Not applicable to this document.** This is a documentation-only change: it adds
Markdown files and modifies no TypeScript, configuration, schema, or dependency.
`Governance/` is outside the Jest root (`jest.config.js` sets `rootDir: 'src'`),
outside the TypeScript build (`tsconfig.build.json` includes `src/**/*`), and
excluded from container images by the `*.md` rule in `.dockerignore`. No existing
test, build step, or runtime path is affected, so no test was added and none was
modified.

No test is added for the same reason no test exists for any other document in
`Governance/`: a test that asserts on the prose of a process document has no
value and would become maintenance debt. What must hold is that the **existing**
lint, typecheck, build, and test suites continue to pass unchanged, verified
through the standard CI pipeline described in `CONTRIBUTING.md` §10.

The verifiable obligations this document does create are checks maintainers
perform, not automated tests:

- Every relative link in this document resolves to a file that exists.
- Every `CONTRIBUTING.md` section reference is checked against the current file.
- Every command named in Phase 1 exists in `package.json` scripts.
- Every prerequisite version in Phase 1 matches the table in `CONTRIBUTING.md`
  §5.

## 8. Documenting Changes

- **Amendments** are submitted as a pull request confined to the
  `Governance/` directory, touching at most two files
  ([`README.md`](../README.md)).
- **Substantive changes** — altering who owns onboarding, the quality gates, or
  the resource list — require asynchronous review and consensus under
  [`policies/ASYNC_DECISIONS.md`](../policies/ASYNC_DECISIONS.md).
- **Decision log.** Adoption or material modification of this process is
  recorded in [`DECISION_LOG.md`](../DECISION_LOG.md).
- **Change log:**

| Version | Date       | Description of Change                                                                                                                                                                                       |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0   | 2026-09-30 | Initial contributor onboarding process: ownership, phased onboarding steps, and the resources provided to a new contributor. Closes the missing onboarding half of the contributor lifecycle (issue #1565). |

## 9. Related Documents

- [`Governance/README.md`](../README.md) — governance framework overview and document index.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — authoritative contribution mechanics.
- [`roles/CONTRIBUTOR.md`](../roles/CONTRIBUTOR.md) — the contributor role, reached by a merged pull request.
- [`roles/MAINTAINER.md`](../roles/MAINTAINER.md) — the role that owns this process.
- [`OFFBOARDING.md`](OFFBOARDING.md) — the offboarding counterpart to this process.
- [`PROMOTION_CRITERIA.md`](PROMOTION_CRITERIA.md) — progression after the first merge.
- [`policies/FIRST_TIME_CONTRIBUTOR.md`](../policies/FIRST_TIME_CONTRIBUTOR.md) — support and mentorship expectations.
- [`policies/GOOD_FIRST_ISSUE.md`](../policies/GOOD_FIRST_ISSUE.md) — the reserved first-contribution task pool.
- [`policies/COMMUNICATION_NORMS.md`](../policies/COMMUNICATION_NORMS.md) — channels and response-time norms.
- [`domains/ACCESS_CONTROL.md`](../domains/ACCESS_CONTROL.md) — how access beyond the repository is requested and approved.
- [`DECISION_LOG.md`](../DECISION_LOG.md) — append-only record of governance decisions.

## Contact

For questions about this process, contact the maintainer team. For questions
about a specific module, contact the module's code owner as mapped in
`CONTRIBUTING.md` §9. For a security concern, do not open a public issue — follow
[`SECURITY_POLICY.md`](../SECURITY_POLICY.md).
