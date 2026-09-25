# Incident Postmortem Policy

This document governs the post-incident review process in TeachLink Backend:
when a formal postmortem is mandatory, the blameless format and methodology to
conduct it, how corrective action items are tracked to completion, and how
learnings are integrated back into the system.

This policy is part of the project's **Security & disclosure** and
**Contribution governance** areas. It lives entirely inside the `Governance/`
folder and does not change application code.

---

## When a Postmortem is Required

A postmortem is mandatory whenever an incident meets any of the following
criteria, mapped to `src/incident-management/`:

1. **Severity Threshold:** Any incident classified as `CRITICAL` or `HIGH`
   severity (`IncidentSeverity.CRITICAL` or `IncidentSeverity.HIGH` in
   `src/incident-management/entities/incident.entity.ts`).
2. **Data Loss or Integrity Compromise:** Any event resulting in loss,
   corruption, unintended deletion, or unauthorized disclosure of user or
   financial records (e.g. payments, grades, authentication credentials).
3. **Sustained Outage:** Any service degradation or complete downtime
   exceeding 15 minutes on core workflows (authentication, payment processing,
   lesson delivery, or webhooks).
4. **Recurring Failures:** Three or more occurrences of the same failure
   signature or alert pattern within any rolling 30-day window, regardless of
   individual severity.
5. **Remediation Failure:** Any incident where automated remediation actions
   (`AutoRemediationService`) or predefined runbooks (`RunbookExecutionService`)
   failed, performed incorrect actions, or required emergency manual rollback.
6. **Significant Near-Miss:** An event that did not result in a customer-facing
   outage only due to fortunate timing or serendipity, where designed
   defenses failed.
7. **Maintainer Discretion:** Any incident deemed by a service owner or
   maintainer to hold significant architectural or operational learning value.

---

## Blameless Methodology & Philosophy

Postmortems in TeachLink are strictly **blameless**:

- **Systemic Focus:** Human error is understood as a consequence of systemic,
  architectural, tooling, or organizational gaps—never the root cause.
- **Psychological Safety:** Contributors and on-call operators must be able to
  provide complete, honest accounts of their actions without fear of
  reprimand or evaluation penalties.
- **Second-Order Understanding:** The investigation seeks to uncover why an
  action made sense to the operator at the time, what information was
  missing, and why the system permitted a catastrophic state to occur.
- **Counterfactuals Avoided:** Questions like "Why didn't you check X?" are
  replaced with "What cues led to the hypothesis that X was operating
  normally?"

---

## Standard Postmortem Format

Every postmortem document must follow the structured format below, saved as a
versioned Markdown record under `docs/incidents/YYYY-MM-DD-<slug>.md` or in the
incident issue thread:

### 1. Incident Overview

- **Incident Title:** Concise description of the failure mode.
- **Incident ID:** Reference to the database ID in `src/incident-management/`.
- **Severity Level:** `CRITICAL` | `HIGH` | `MEDIUM`.
- **Date & Duration:** Total elapsed time from detection to verified recovery
  (Time to Detect, Time to Mitigate, Time to Resolve).
- **Incident Commander:** The primary responder coordinating resolution.
- **Service Owner:** The owner accountable under
  `Governance/domains/SERVICE_OWNERSHIP.md`.

### 2. Impact Summary

- User-facing impact (number of users impacted, failed HTTP requests, error
  rates, degraded functionality).
- Financial or data impact (failed transactions, delayed payouts, corrupted
  records).
- Breaches of Service Level Objectives (SLOs).

### 3. Chronological Timeline (UTC)

A detailed sequence of events with exact timestamps:

- `T0` (Trigger): When the defect or root condition was introduced or started.
- `T1` (Detection): When alerts fired (`IncidentDetectionService`) or reports
  surfaced.
- `T2` (Triage): When on-call responders acknowledged and began investigation.
- `T3` (Mitigation): When stabilizing actions were taken (runbook execution,
  traffic shed, rollback).
- `T4` (Resolution): When full system health was restored and verified.

### 4. Root Cause Analysis

- **Five Whys:** Iterative causal chain tracing back from immediate symptoms to
  underlying systemic causes.
- **Trigger Condition:** The proximate event that initiated failure.
- **Latent Flaws:** Existing vulnerabilities, missing guards, or unhandled
  edge cases that allowed the trigger to propagate.
- **Detection & Observability Gaps:** Why existing monitors or health checks
  failed to catch the problem earlier.

### 5. Lessons Learned

- **What Went Well:** Effective alerting, rapid rollback, helpful logs, or
  runbook clarity.
- **What Went Poorly:** Ambiguous error messages, slow escalations, missing
  documentation, or tooling deficiencies.
- **Where We Got Lucky:** Fortuitous circumstances that limited blast radius.

---

## Action-Item Tracking & Governance

Learning without remediation leads to repeated incidents. All postmortems must
yield concrete, verifiable action items:

### Categorization

Every action item is classified into one of three preventive categories:

1. **Prevent:** Architectural changes, validation guards, schema constraints,
   or automated tests preventing the failure from happening again.
2. **Detect:** New metrics, alert rules, or canary probes that alert within
   60 seconds of early symptoms.
3. **Mitigate:** Enhanced runbooks, automated circuit breakers, or self-healing
   handlers that reduce Mean Time to Resolution (MTTR).

### Rules of Engagement

- **Explicit Accountability:** Every action item must have an assigned owner
  (a named maintainer or service owner), not a team or generic label.
- **Issue Association:** Every action item must link to an open, tracked GitHub
  issue before the postmortem review closes.
- **Resolution SLAs:**
  - `P0` (Critical prevention): Must be merged and deployed within 7 calendar
    days.
  - `P1` (High detection/mitigation): Must be resolved within 14 calendar days.
  - `P2` (Long-term hardening): Prioritized in the subsequent sprint.
- **No Silent Closure:** An action item cannot be closed as "done" until its
  verification test or automated guard is merged and running in CI.

---

## Lifecycle & Review Timeline

1. **Resolution:** Incident resolved in production.
2. **Within 48 Hours:** Incident Commander produces a complete draft
   postmortem following the standard format.
3. **Within 5 Business Days:** Maintainers and service owners convene for an
   asynchronous or synchronous postmortem review to validate findings and
   finalize action items.
4. **Approval & Publication:** The document is approved and recorded in the
   repository.
5. **Quarterly Audit:** Maintainers audit open postmortem action items during the
   quarterly review alongside `Governance/DECISION_LOG.md` and
   `Governance/domains/SERVICE_OWNERSHIP.md`.

---

## Review

This policy is reviewed annually or following any major re-architecture of the
incident management subsystem (`src/incident-management/`). Amendments require
the standard governance workflow described in `Governance/README.md` and must
remain self-contained within the `Governance/` directory.
