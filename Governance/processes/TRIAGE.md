# Issue Triage Process

**Document:** `Governance/processes/TRIAGE.md`
**Status:** Active
**Last Updated:** 2026-09-28
**Owner:** Maintainer Team

---

## Purpose

This document defines the process for triaging newly opened issues in the TeachLink Backend repository. Triage ensures every issue is assessed, categorised, and routed promptly so contributors and maintainers can act on it without ambiguity.

---

## Scope

This process applies to all issues opened against `rinafcode/teachLink_backend`.

---

## Triage Steps

### Step 1 — Acknowledge the Issue

Within **2 business days** of an issue being opened, a maintainer must:

- Post a comment acknowledging receipt (can be brief: *"Thanks, triaging this now."*)
- Assign themselves or another maintainer as the triager.

### Step 2 — Validate the Issue

The triager checks whether the issue is:

| Outcome | Action |
|---|---|
| **Duplicate** | Close with `duplicate` label, link to original |
| **Out of scope** | Close with `wontfix` + brief explanation |
| **Needs more information** | Add `needs: more info` label, request clarification from author |
| **Valid** | Proceed to Step 3 |

### Step 3 — Classify the Issue

Apply the appropriate **type** label:

| Label | When to use |
|---|---|
| `type: bug` | Existing functionality is broken or behaves incorrectly |
| `type: feature` | New capability is being requested |
| `type: improvement` | Enhancement to existing functionality |
| `type: docs` | Documentation gap or error |
| `type: governance` | Policy, process, or governance document |
| `type: chore` | Maintenance, dependency update, CI, tooling |
| `type: question` | General question (consider redirecting to Telegram) |

### Step 4 — Assign Priority

Apply exactly one **priority** label:

| Label | Criteria |
|---|---|
| `priority: critical` | Production broken, security vulnerability, data loss risk |
| `priority: high` | Major feature blocked, significant user impact |
| `priority: medium` | Noticeable issue; a workaround exists |
| `priority: low` | Minor inconvenience; cosmetic or edge-case |

### Step 5 — Assign to a Milestone (if applicable)

If the issue fits an active milestone, assign it. If not, leave the milestone field empty; the issue will be picked up during the next roadmap review.

### Step 6 — Assign a Contributor (if applicable)

If a specific contributor is best placed to handle the issue (or has expressed interest), assign them. Otherwise leave unassigned so the community can self-select.

### Step 7 — Add the `triaged` Label

Once Steps 1–6 are complete, add the `triaged` label. This signals that the issue is ready to be picked up.

---

## Triage Cadence

| Activity | Frequency |
|---|---|
| New issue triage | Within 2 business days of opening |
| Backlog review | Weekly (every Monday) |
| Stale issue sweep | Monthly (first Monday of the month) |

---

## Required Labels After Triage

Every triaged issue must have:

1. One `type:` label
2. One `priority:` label
3. The `triaged` label

Issues missing any of these after 5 business days should be flagged in the weekly backlog review.

---

## Stale Issues

An issue is considered stale if it has had no activity for **60 days**. Stale issues should be:

1. Commented on to check continued relevance.
2. Closed with `status: stale` if no response is received within **14 days**.

---

## Escalation

If a high or critical priority issue has not been triaged within **1 business day**, any contributor may escalate by tagging `@rinafcode/maintainers` in the issue comments.

---

## Related Documents

- `Governance/LABEL_TAXONOMY.md` — Full label definitions
- `Governance/processes/MILESTONE_GOVERNANCE.md` — Milestone assignment rules
- `Governance/policies/REVIEW_SLA.md` — Review SLA for pull requests
- `CONTRIBUTING.md` — General contribution guidelines
