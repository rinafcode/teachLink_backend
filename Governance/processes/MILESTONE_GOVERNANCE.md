# Milestone Governance Process

**Document:** `Governance/processes/MILESTONE_GOVERNANCE.md`
**Status:** Active
**Last Updated:** 2026-09-28
**Owner:** Maintainer Team

---

## Purpose

This document defines how milestones are created, managed, and closed for the TeachLink Backend repository. A clear milestone governance process ensures that release planning is transparent, that issues are properly scoped per milestone, and that contributors understand what is targeted for each release.

---

## Scope

This process applies to all milestones created in `rinafcode/teachLink_backend`.

---

## Milestone Creation

### Who Can Create Milestones

Only maintainers (members of `@rinafcode/maintainers`) may create milestones. Contributors may propose a milestone by opening a discussion issue tagged `type: governance`.

### When to Create a Milestone

A milestone should be created when:

- A new release version is being planned (e.g., `v1.2.0`).
- A thematic batch of work is being tracked (e.g., `Security Hardening Sprint`).
- A time-boxed programme of contributions is starting (e.g., `Stellar Wave Q3 2026`).

### Required Fields

Every milestone must be created with:

| Field | Requirement |
|---|---|
| **Title** | Descriptive and versioned where applicable (e.g., `v1.3.0 – Search Improvements`) |
| **Due date** | A realistic target date (mandatory; use best estimate if exact date is unknown) |
| **Description** | A 1–3 sentence summary of the milestone's goal and scope |

---

## Entry Criteria

An issue or PR may be assigned to a milestone when **all** of the following are true:

1. The issue has been triaged (carries the `triaged` label).
2. The issue is within the milestone's defined scope.
3. The work can realistically be completed before the milestone due date.
4. A contributor is either assigned or has expressed intent to work on it.

Issues that do not meet entry criteria must not be added to the milestone.

---

## Milestone Management

### Adding Issues

Maintainers add issues to a milestone during:

- **Milestone planning sessions** — held when a new milestone is opened.
- **Weekly backlog reviews** — newly triaged issues assessed for fit.

Issues must not be added to a closed milestone.

### Removing Issues

An issue must be removed from a milestone (returned to backlog) if:

- It is determined to be out of scope.
- The contributor assigned to it is no longer available and no replacement is found within 5 business days.
- A dependency blocker means it cannot be completed before the due date.

When removing an issue, a maintainer must leave a comment explaining why it was descoped.

### Milestone Due Date Changes

Due dates may be extended by a maintainer if:

- More than 20% of milestone issues are blocked.
- An unforeseen high-priority issue consumes significant capacity.

Due date changes must be announced in the milestone description with a reason and the new date.

---

## Exit Criteria

A milestone may be closed when **all** of the following are true:

1. All issues assigned to the milestone are either closed or explicitly descoped with a comment.
2. All PRs associated with the milestone are either merged or closed.
3. A release (if applicable) has been tagged and published.
4. A milestone summary comment has been posted (see below).

### Milestone Summary Comment

Before closing a milestone, a maintainer must post a comment on the milestone (via GitHub's milestone interface) or in the linked discussion containing:

- Total issues completed vs. total scoped.
- Any notable descoped items and why.
- Lessons learned (optional but encouraged).

---

## Milestone Naming Convention

| Type | Format | Example |
|---|---|---|
| Release | `vMAJOR.MINOR.PATCH – Short description` | `v1.3.0 – Payment Module Refactor` |
| Sprint / Theme | `[Theme] Sprint – Short description` | `Security Hardening Sprint – Q4 2026` |
| Programme | `[Programme Name] Batch N` | `Stellar Wave Batch 3` |

---

## Roles and Responsibilities

| Role | Responsibility |
|---|---|
| **Project Lead** | Approves milestone creation; sets strategic priorities |
| **Maintainer** | Creates, manages, and closes milestones; triages issues into milestones |
| **Contributor** | Picks up assigned issues; communicates blockers promptly |

---

## Related Documents

- `Governance/processes/TRIAGE.md` — How issues are triaged before milestone assignment
- `Governance/LABEL_TAXONOMY.md` — Labels used during triage and milestone management
- `Governance/policies/REVIEW_SLA.md` — Review timelines affecting milestone velocity
- `CONTRIBUTING.md` — General contribution guidelines
