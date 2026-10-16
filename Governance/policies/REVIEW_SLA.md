# Review SLA Policy

**Document:** `Governance/policies/REVIEW_SLA.md`
**Status:** Active
**Last Updated:** 2026-09-28
**Owner:** Maintainer Team

---

## Purpose

This policy defines the expected response and review-completion timescales for pull requests submitted to the TeachLink Backend repository. It ensures contributors receive timely feedback and that the review queue does not stall.

---

## Scope

This policy applies to all pull requests opened against `rinafcode/teachLink_backend`, regardless of branch target (`main` or `develop`).

---

## SLA Targets

| Review Stage | Target Timeframe | Measured From |
|---|---|---|
| First-response acknowledgement | **2 business days** | PR opened |
| Substantive review (comments or approval) | **5 business days** | PR opened |
| Follow-up review after changes requested | **3 business days** | Author pushes requested changes |
| Final approval or rejection | **7 business days** | PR opened |

> **Business days** are Monday–Friday, excluding public holidays. Weekends and holidays do not count toward SLA timers.

---

## First-Response Target

A reviewer **must** leave at least one of the following within **2 business days** of a PR being opened:

- An approval
- A change request with at least one actionable comment
- A neutral comment acknowledging receipt (e.g., *"Queued for review — will respond in full by [date]"*)

Silently leaving a PR in the queue without any acknowledgement beyond the 2-day window is a policy breach.

---

## Review-Completion Target

A full, substantive review must be completed within **5 business days** of the PR being opened.

A "complete review" means:

1. All files have been inspected.
2. A verdict has been recorded: **Approve**, **Request Changes**, or **Comment**.
3. Any blocking issues are described clearly and actionably.

---

## Escalation Path

If SLA targets are not met, the following escalation steps apply:

1. **Day 6 (after PR open):** The PR author may ping the reviewer directly in the PR comments, tagging `@rinafcode/maintainers`.
2. **Day 8:** The author may escalate to the project lead via the [Telegram community](https://t.me/teachlinkOD) or by opening a discussion.
3. **Day 10:** A co-maintainer may self-assign the review and complete it independently.

Escalation should remain professional. The goal is to unblock the contributor, not to assign blame.

---

## Reviewer Responsibilities

- Reviewers should not approve PRs they have not read thoroughly.
- Reviewers must leave clear, actionable feedback when requesting changes.
- Reviewers should acknowledge when a PR is out of their expertise and reassign accordingly.

---

## Author Responsibilities

- Authors must respond to change requests within **5 business days** to keep the PR active.
- Authors must keep PRs reasonably scoped (prefer small, focused changes) to make timely reviews feasible.
- Authors must ensure CI passes before requesting review.

---

## Exceptions

The following situations may extend the SLA without breach:

- Maintainer has announced a leave of absence.
- PR requires specialist knowledge not currently available in the team.
- PR is intentionally placed on hold pending a design decision (must be labelled `status: on-hold`).

Exceptions must be documented in the PR as a comment.

---

## Compliance

Maintainers are expected to self-monitor SLA adherence. The project lead will review aggregate SLA data quarterly and take corrective action if systemic delays are observed.

---

## Related Documents

- `Governance/processes/TRIAGE.md` — Issue triage process
- `Governance/policies/STALE_PRS.md` — Policy for closing stale pull requests
- `CONTRIBUTING.md` — General contribution guidelines
