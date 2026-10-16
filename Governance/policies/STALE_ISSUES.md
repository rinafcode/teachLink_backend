# Stale Issue Policy

**Document:** `Governance/policies/STALE_ISSUES.md`
**Status:** Active
**Last Updated:** 2026-09-29
**Owner:** Maintainer Team

---

## Purpose

This policy defines what makes an issue stale, the steps taken before it is closed, and how a closed issue is brought back. The goal is an issue tracker that reflects work someone actually intends to do, so that a contributor browsing it finds real work rather than a backlog of abandoned reports.

It is the detailed counterpart to the summary in [`../processes/TRIAGE.md`](../processes/TRIAGE.md) § *Stale Issues*, and uses the same thresholds.

---

## Scope

This policy applies to all issues opened against `rinafcode/teachLink_backend`.

It does **not** apply to pull requests, which are covered by [`STALE_PRS.md`](STALE_PRS.md) on a shorter timer.

---

## Staleness Threshold

An issue is considered **stale** when it has received **no activity for 60 calendar days**. Activity includes:

- A comment from anyone.
- A label, milestone, or assignee change by a maintainer.
- A linked pull request being opened, updated, or closed.
- A reaction from a maintainer signalling continued interest.

The 60-day window restarts every time any of the above occurs.

### Why 60 days, when a PR goes stale at 30

The two artefacts decay differently, so they are timed differently.

A **pull request** is in-flight work that rots on its own: the branch drifts from `main`, conflicts accumulate, and the review context fades from everyone's memory. Thirty days of silence usually means the work has stopped.

An **issue** is a statement that something is wrong or missing. A bug nobody has reached is still a bug after two months, and an unclaimed feature request is not invalid merely because the queue is long. Closing issues on a PR's timer discards valid reports and teaches contributors that filing one is pointless.

Sixty days matches `status: stale` in [`../LABEL_TAXONOMY.md`](../LABEL_TAXONOMY.md) and the triage process. All three should be changed together if the threshold is ever revised.

---

## Warning and Closing Steps

When an issue becomes stale, the following sequence is followed:

### Step 1 — Stale Label and Comment (Day 60)

The `status: stale` label is applied and a comment is posted:

> *"This issue has had no activity for 60 days and has been marked stale. If it is still relevant, please leave a comment saying so — a single comment is enough to keep it open. Without a response it will be closed on [date = Day 74]. Closing is not a judgement on the report; it can be reopened at any time."*

The comment names the closing date explicitly. "Will be closed soon" gives nobody a reason to act today.

### Step 2 — Maintainer Check (Day 67)

If there is still no activity 7 days after the label is applied, a maintainer checks whether the issue should be exempt rather than closed:

- Is it still reproducible, or still a genuine gap?
- Is it blocked by something outside any contributor's control?
- Is it a valid report that simply has not been prioritised? If so, it is a backlog problem, not a stale one — apply `status: blocked` or a milestone and remove the stale label.
- Is it a good candidate for a new contributor? If so, label it per [`GOOD_FIRST_ISSUE.md`](GOOD_FIRST_ISSUE.md) and remove the stale label rather than closing it.

The maintainer records their assessment in a comment.

### Step 3 — Closure (Day 74)

If there is no activity for **14 calendar days** after the stale label is applied (74 days total since last activity), the issue is **closed as not planned** with:

> *"Closing this issue due to inactivity. This is not a judgement on whether the problem is real — it keeps the tracker reflecting active work. If this still affects you, comment here and it will be reopened; no new issue is needed."*

Issues are closed **as not planned**, never as completed. Closing an unfixed bug as completed corrupts the project's own history and any metrics drawn from it.

The `status: stale` label remains on the closed issue for historical filtering.

---

## Exemptions

The following prevent the stale timer from applying:

| Situation | Action |
|---|---|
| Issue is labelled `status: blocked` | Timer is paused; the maintainer must document the blocker |
| Issue is assigned to a milestone | Timer is paused until the milestone closes or the issue is removed from it |
| Issue is labelled `priority: critical` or `priority: high` | Never auto-closed. Sustained inactivity here is a triage failure, and is escalated per [`../processes/TRIAGE.md`](../processes/TRIAGE.md) rather than resolved by closing the issue |
| Issue is a confirmed security report | Never auto-closed; governed by [`../SECURITY_POLICY.md`](../SECURITY_POLICY.md) and [`../processes/COORDINATED_DISCLOSURE.md`](../processes/COORDINATED_DISCLOSURE.md) |
| Issue tracks a governance decision | Timer is paused until the decision is recorded in [`../DECISION_LOG.md`](../DECISION_LOG.md) |
| Issue has an open linked pull request | Timer is paused; [`STALE_PRS.md`](STALE_PRS.md) governs the PR |
| Issue is labelled `status: on hold` | Timer is paused until the hold is lifted |

A `good first issue` is **not** exempt, but under step 2 it is refreshed rather than closed where it remains a genuine entry point.

---

## Reopen Path

**Any person may reopen a stale-closed issue by commenting on it.** No new issue, no justification, and no maintainer permission is needed — a comment saying the problem still occurs is sufficient.

On reopening:

1. The `status: stale` label is removed.
2. The issue re-enters triage per [`../processes/TRIAGE.md`](../processes/TRIAGE.md), and the 60-day timer restarts from the reopening comment.
3. If the original report was thin, the person reopening is asked — not required — to add current reproduction details.

If you cannot reopen the issue yourself, comment anyway; a maintainer reopens it at triage.

There is no limit on how many times an issue may be reopened, and no penalty for having one closed as stale.

---

## Maintainer Responsibilities

- Review the stale issue list as part of the weekly backlog review, alongside stale PRs.
- Never close an issue without the step 1 warning and its stated date.
- Check the exemption table before closing, not after.
- Remove `status: stale` promptly when activity resumes, so the label stays meaningful as a filter.
- Treat a high volume of stale closures as a signal about triage capacity, not as housekeeping done well.

---

## Metrics

Maintainers should track monthly:

- Number of issues marked stale.
- Number of stale issues closed vs. rescued (activity resumed before closure).
- Number of stale-closed issues later reopened — a high figure means the threshold or the exemptions are wrong, not that contributors are being difficult.
- Median age of open issues at the point of being marked stale.

These feed the reporting in [`TRANSPARENCY_REPORTS.md`](TRANSPARENCY_REPORTS.md) and [`PUBLIC_METRICS.md`](PUBLIC_METRICS.md).

---

## Related Documents

- `Governance/policies/STALE_PRS.md` — the equivalent policy for pull requests, on a 30-day timer
- `Governance/policies/INACTIVITY.md` — inactivity of people, as distinct from artefacts
- `Governance/processes/TRIAGE.md` — issue triage, including the stale summary this policy expands
- `Governance/LABEL_TAXONOMY.md` — label definitions, including `status: stale`
- `Governance/policies/GOOD_FIRST_ISSUE.md` — criteria for issues kept open as entry points
- `CONTRIBUTING.md` — general contribution guidelines
