# Role Promotion Criteria

This document defines the **objective criteria** for promotion between the
project's roles, **who nominates and approves** a promotion, and the
**evidence** required to support it.

The project uses a membership ladder. From the baseline of contributor, the
roles are defined in the `Governance/roles/` folder and are reached through the
process below:

- Contributor → Reviewer / Issue Triager → Committer → Maintainer → Lead Maintainer

Promotions are **evidence-based and reviewed by the maintainers**, never
self-awarded. The criteria below are minimum requirements; meeting them does not
guarantee promotion.

## Objective Criteria per Role

### Reviewer

A candidate must have:

- At least **three merged, self-contained contributions** (code, documentation,
  or governance) that follow the repository standards in `CONTRIBUTING.md` (§4,
  §7, §8).
- A demonstrated record of **thoughtful review activity** on other people's
  pull requests (comments that catch real issues, respectful and specific
  feedback), per the reviewer expectations in `CONTRIBUTING.md` §9.
- No unresolved, unaddressed quality concerns against their own recent
  contributions.

### Issue Triager

A candidate must have:

- A demonstrated record of **issue hygiene** — helping reproduce, clarify, and
  scope issues in the tracker.
- Familiarity with the repository's issue labels (bug, feature, documentation,
  enhancement, good first issue, and the quality-gate / area labels) and their
  intended use.
- Consent to apply the restriction that triagers **re-triage but do not
  unilaterally close** contested issues.

### Committer

A candidate must have:

- A sustained record as a **reviewer** (or equivalent sustained review
  activity) over recent cycles.
- A solid grasp of the defence-in-depth expectations in `CONTRIBUTING.md` §8 —
  input validation at boundaries, proper NestJS exceptions, use of the shared
  logger, auth guards applied consistently.
- Evidence of **adhering to merge and review policy** — including never
  force-pushing during review and never self-merging.

### Maintainer

A candidate must have:

- Sustained, high-quality contributions and **reliable review performance**
  within the review SLA (`CONTRIBUTING.md` §9).
- Demonstrated command of the quality gates and branch-protection rules
  (`CONTRIBUTING.md` §4) and of the merging rules (`CONTRIBUTING.md` §11).
- A track record of **keeping changes small, documented, and within scope** —
  for governance work, limited to the `Governance/` folder.
- The trust of the existing maintainers, evidenced by an approval decision
  recorded in the nomination.

### Lead Maintainer

A candidate must have:

- An established record as a **maintainer**, including carrying the deciding
  voice and escalation when maintainer consensus fails (per
  `Governance/roles/LEAD_MAINTAINER.md`).
- A demonstrated ability to arbitrate disagreements fairly and to represent the
  project's governance in public decision records.

## Nomination and Approval

- **Who can nominate** — any contributor may nominate themselves or another
  contributor. Nominations are recorded as an issue in the repository using the
  appropriate role and quality-gate labels.
- **Who approves** — the maintainers review nominations; the **lead maintainer**
  carries the deciding voice if no consensus forms, and the outcome is recorded
  on the nomination issue. Reviewer, Issue Triager, and Committer promotions
  may be handled by an accessible maintainer group within the review SLA.
- **Cadence** — nominations are reviewed continuously; approvals should be
  recorded within the standard review SLA (`CONTRIBUTING.md` §9).

## Evidence Required

Every nomination must attach, as evidence on the issue:

- **Merged contributions** — links to merged pull requests (with the content
  being evaluated called out: code, review, or documentation).
- **Review activity** — links to specific review comments that demonstrate the
  quality expected for the target role.
- **Issue activity** (for triager) — links to issues the candidate clarified,
  reproduced, or scoped.
- **Policy adherence** — examples of the candidate following the commit
  convention, the quality gates, and the no-force-push / no-self-merge rules.
- **Recorded outcome** — a short statement of the maintainers' decision and the
  reasoning behind it.

Evidence that cannot be linked (for example off-platform work) is not
considered; decisions are based on visible, auditable repository activity.

## Reviewing This Process

The maintainers review this process at least once a year, together with the
role documents it references. Changes to this process follow a pull request
limited to the `Governance/` folder, reviewed per `CONTRIBUTING.md` §9 and §11.