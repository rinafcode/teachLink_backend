# Stale PR Policy

**Document:** `Governance/policies/STALE_PRS.md`
**Status:** Active
**Last Updated:** 2026-09-28
**Owner:** Maintainer Team

---

## Purpose

This policy defines what makes a pull request stale, the steps taken to nudge an author back into action, and the conditions under which a stale PR is closed. The goal is to keep the pull-request queue clean and actionable without discouraging contributors.

---

## Scope

This policy applies to all pull requests opened against `rinafcode/teachLink_backend`, regardless of target branch.

---

## Staleness Threshold

A pull request is considered **stale** when it has received **no activity for 30 calendar days**. Activity includes:

- A commit pushed to the PR branch.
- A comment left by the author or any reviewer.
- A review submitted (approve, request changes, or comment).
- A label change by a maintainer.

The 30-day window restarts every time any of the above activities occurs.

---

## Nudge Steps

When a PR becomes stale, the following sequence is followed:

### Step 1 — Automated Stale Label (Day 30)

The `status: stale` label is applied to the PR. An automated comment (or a maintainer comment) is posted:

> *"This PR has been inactive for 30 days. It has been marked as stale. If you are still working on this, please leave a comment or push a new commit within 14 days to keep it open. If no activity is recorded, the PR will be closed on [date = Day 44]."*

### Step 2 — Maintainer Review (Day 37)

If there is still no activity 7 days after the stale label is applied, a maintainer checks whether:

- The PR is blocked by something outside the author's control (e.g., an unresolved dependency).
- The PR could be taken over by another contributor.
- The PR should be closed without merge.

The maintainer documents their assessment in a comment.

### Step 3 — Closure (Day 44)

If there is no activity for **14 calendar days** after the stale label is applied (44 days total since last activity), the PR is **closed** with the following comment:

> *"Closing this PR due to inactivity. The branch and commits are preserved — please feel free to reopen or open a new PR when you are ready to continue. Thank you for your contribution."*

The `status: stale` label remains on the closed PR for historical filtering.

---

## Exceptions

The following situations prevent the stale policy from applying:

| Situation | Action |
|---|---|
| PR is labelled `status: on hold` | Stale timer is paused until the hold is lifted |
| PR is labelled `status: blocked` | Stale timer is paused; maintainer must document the blocker |
| PR is a draft (`Draft` state in GitHub) | Stale policy does not apply until converted to ready |
| PR is actively being reviewed | Stale timer restarts on each review action |

---

## Reopen Path

A closed stale PR may be reopened by:

1. The original author, if the branch still exists and no conflicts have arisen.
2. Any contributor, by opening a **new PR** referencing the original.

When reopening or creating a replacement PR, the author should:

- Rebase onto the latest `main`.
- Resolve any review comments that were previously raised.
- Mention the original PR number for context (e.g., *"Replaces #456"*).

There is no penalty for having a PR closed as stale. Contributions are always welcome.

---

## Maintainer Responsibilities

- Review the stale PR list as part of the weekly backlog review.
- Do not close PRs without leaving a clear, friendly closure comment.
- Consider whether a stale PR can be reassigned before closing.
- Ensure the `status: stale` label is removed if activity resumes before closure.

---

## Metrics

Maintainers should track the following monthly:

- Number of PRs marked stale.
- Number of stale PRs closed vs. rescued (activity resumed).
- Average age of closed stale PRs.

High stale rates may indicate onboarding friction, unclear contribution guidelines, or overly complex review requirements.

---

## Related Documents

- `Governance/policies/REVIEW_SLA.md` — Review SLA policy
- `Governance/processes/TRIAGE.md` — Issue triage process
- `Governance/LABEL_TAXONOMY.md` — Label definitions including `status: stale`
- `CONTRIBUTING.md` — General contribution guidelines
