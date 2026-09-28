# Decision Log

This document defines the format for TeachLink Backend's decision log: the
running, versioned record of governance and project decisions, separate from
the more detailed rationale an ADR (`Governance/processes/ADR_PROCESS.md`,
where one exists) captures for a single significant technical choice.

This document is part of the project's **Decision-making** area. It lives
entirely inside the `Governance/` folder and does not change application
code.

## Purpose

Not every decision needs a full RFC or ADR, but every decision that affects
how the project is run — a policy adopted, a process changed, a role
granted, a formal vote's outcome — should be findable in one place, in
chronological order, without digging through issue history. The decision log
is that place.

## What Belongs Here

An entry is added to the decision log for:

- The outcome of a formal vote (`Governance/processes/FORMAL_VOTING.md`) or a
  lazy-consensus decision (`Governance/processes/LAZY_CONSENSUS.md`) that
  reached a conclusion.
- Adoption, amendment, or retirement of a governance policy or process (a
  merged pull request under `Governance/`).
- A role change that isn't purely routine (a new maintainer, an emeritus
  transition, a revocation).
- Any other decision a maintainer judges significant enough that future
  contributors would otherwise have to reconstruct it from issue archaeology.

Routine, reversible engineering decisions (a library choice, a refactor) do
not belong here — those are covered by code review and, where the choice is
significant, an ADR.

## Entry Format

Entries are appended in a table, newest at the bottom, immediately below this
section. Each entry captures:

| Field | Meaning |
| --- | --- |
| **Date** | ISO 8601 date the decision was finalised (not when discussion started). |
| **Decision** | One-sentence statement of what was decided. |
| **Type** | `vote` \| `lazy-consensus` \| `policy` \| `role` \| `other`. |
| **Reference** | Link to the issue, pull request, or vote thread that recorded the decision. |
| **Maintained by** | The maintainer who logged the entry (see below). |

```markdown
| Date | Decision | Type | Reference | Maintained by |
| --- | --- | --- | --- | --- |
| 2026-01-15 | Adopt the objection-handling process | policy | #1582 | @example-maintainer |
```

| Date | Decision | Type | Reference | Maintained by |
| --- | --- | --- | --- | --- |
| 2026-09-26 | Adopt the backup policy (frequency, restore-test cadence, retention) | policy | — | @maintainer |
| 2026-09-26 | Adopt the SBOM policy (generation triggers, publication, update cadence) | policy | — | @maintainer |
| 2026-09-26 | Adopt the rate limit governance (limit setting, exemption process, review cadence) | policy | — | @maintainer |

Entries are never edited after the fact to change what was decided — this log
is append-only, matching the immutability principle used for the audit log
(`Governance/domains/AUDIT_LOG.md`). A decision that is later reversed gets a
**new** entry recording the reversal and referencing the original.

## Who Maintains It

- Any maintainer may append an entry once a decision is finalised; it does
  not require the decision-maker themselves to log it, only that the entry
  accurately reflects the outcome and links to its reference.
- A pull request that adopts a governance policy or process should include
  the corresponding decision-log entry in the same change where practical,
  so the two never drift out of sync.
- If a decision is made without a log entry at the time, any maintainer may
  add it retroactively, dated to when the decision was actually made (not
  the date it was logged), noting in the entry that it was added
  retroactively.
- Maintainers review the decision log at the same quarterly cadence as the
  service-ownership review (`Governance/domains/SERVICE_OWNERSHIP.md`) to
  catch decisions that were made but never logged.

## Review

This document is reviewed whenever the decision-making processes it
references change materially. Changes are proposed through the normal
governance process described in `Governance/README.md` and must touch only
the `Governance/` folder.
