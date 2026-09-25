# Incident Postmortem Policy

This document governs the post-incident review process in TeachLink Backend: when a formal postmortem is mandatory, the blameless methodology used to conduct it, how corrective action items are tracked to completion, and how lessons learned are integrated back into the system.

This policy is part of the project's **Security & disclosure** and **Contribution governance** areas. It lives entirely inside the `Governance/` folder and does not change application code.

---

## When a Postmortem is Required

A postmortem is mandatory whenever an incident meets any of the following criteria:

1. **Severity Threshold:** Any incident classified as `CRITICAL` or `HIGH` severity (`IncidentSeverity.CRITICAL` or `IncidentSeverity.HIGH` in `src/incident-management/entities/incident.entity.ts`).
2. **Data Loss or Integrity Compromise:** Any event resulting in loss, corruption, unintended deletion, or unauthorized disclosure of user or financial records (for example payments, grades, or authentication credentials).
3. **Sustained Outage:** Any service degradation or complete downtime exceeding 15 minutes on core workflows (authentication, payment processing, lesson delivery, or webhooks).
4. **Recurring Failures:** Three or more occurrences of the same failure signature or alert pattern within any rolling 30-day window, regardless of individual severity.
5. **Remediation Failure:** Any incident where automated remediation actions (`AutoRemediationService`) or predefined runbooks (`RunbookExecutionService`) failed, performed incorrect actions, or required emergency manual rollback.
6. **Emergency Production Changes:** Any emergency production change, including an emergency rollback, taken to restore service when normal approval was unavailable.
7. **Significant Near-Miss:** An event that did not result in a customer-facing outage only due to fortunate timing or circumstances where intended defenses failed.
8. **Maintainer Discretion:** Any incident deemed by a service owner or maintainer to hold significant architectural or operational learning value.

An `INFO` or lower-impact incident that does not meet the above criteria does not require a formal postmortem. The incident commander or service owner should record the rationale for waiving the review in the incident record. Maintainers may still require a postmortem when circumstances warrant one.

---

## Ownership

- The incident commander coordinates the review and ensures that the incident record links to the resulting postmortem.
- The affected service owner prepares the draft with input from responders and any other affected teams.
- Where practical, a reviewer who was not directly responsible for the affected change or system should review the postmortem.
- The incident commander ensures all required action items are created before the review is closed.
- The service owner follows action items through completion and verifies the intended improvement where practical.

---

## Blameless Methodology & Philosophy

Postmortems in TeachLink are strictly **blameless**:

- **Systemic Focus:** Human error is understood as a consequence of systemic, architectural, tooling, documentation, or organizational gaps and is never considered the root cause by itself.
- **Psychological Safety:** Contributors and responders must be able to provide complete, honest accounts of their actions without fear of reprimand or performance evaluation penalties.
- **Second-Order Understanding:** Investigations seek to uncover why an action appeared reasonable at the time, what information was missing, and why the system allowed failure conditions to exist.
- **Counterfactuals Avoided:** Questions such as "Why didn't you check X?" should be replaced with "What information led responders to believe X was functioning normally?"
- **No Individual Blame:** Do not name or single out individuals as the cause of an incident. Focus on systems, safeguards, processes, information flow, documentation, tooling, and environmental conditions.

---

## Standard Postmortem Format

Every postmortem document must follow the structured format below, saved as a versioned Markdown record under `docs/incidents/YYYY-MM-DD-<slug>.md` or in the incident issue thread.

### 1. Incident Overview

- **Incident Title:** Concise description of the failure mode.
- **Incident ID:** Reference to the incident record.
- **Severity Level:** `CRITICAL` | `HIGH` | `MEDIUM`.
- **Date & Duration:** Total elapsed time from detection to verified recovery, including Time to Detect (TTD), Time to Mitigate (TTM), and Time to Resolve (TTR).
- **Incident Commander:** The primary responder coordinating resolution.
- **Service Owner:** The owner accountable under `Governance/domains/SERVICE_OWNERSHIP.md`.

### 2. Impact Summary

- User-facing impact, including affected users, failed requests, error rates, or degraded functionality.
- Financial, security, privacy, or data impact, including failed transactions or corrupted records.
- Breaches of Service Level Objectives (SLOs).
- Explicitly state when no impact in a category was observed.

### 3. Chronological Timeline (UTC)

A detailed sequence of events with timestamps in UTC.

- `T0` (Trigger): When the defect or root condition was introduced or began.
- `T1` (Detection): When alerts fired or reports surfaced.
- `T2` (Triage): When responders acknowledged and began investigation.
- `T3` (Mitigation): When stabilizing actions were taken.
- `T4` (Resolution): When full system health was restored and verified.

### 4. Root Cause Analysis

- **Five Whys:** Iterative causal analysis tracing symptoms to underlying systemic causes.
- **Trigger Condition:** The immediate event that initiated failure.
- **Latent Flaws:** Existing vulnerabilities, missing safeguards, process gaps, or unhandled edge cases.
- **Detection & Observability Gaps:** Reasons existing monitoring, alerting, or operational processes failed to identify the issue sooner.

### 5. Lessons Learned

- **What Went Well:** Effective alerting, rollback procedures, communication, logging, or documentation.
- **What Went Poorly:** Ambiguous error messages, slow escalation paths, missing documentation, tooling deficiencies, or process weaknesses.
- **Where We Got Lucky:** Circumstances that reduced impact despite defensive controls being insufficient.

### 6. Corrective Actions

Every postmortem must include prioritized follow-up actions with:

- A clearly defined outcome.
- One accountable owner.
- A target due date.
- A priority based on expected risk reduction.
- Links to tracking issues.

---

## Action-Item Tracking & Governance

Learning without remediation leads to repeated incidents. All postmortems must yield concrete, verifiable action items.

### Categorization

Every action item should be classified into one of the following categories:

1. **Prevent:** Architectural improvements, validation safeguards, schema constraints, or automated tests that reduce the likelihood of recurrence.
2. **Detect:** Metrics, alerts, dashboards, or canary checks that improve early detection.
3. **Mitigate:** Runbook improvements, automation, fallback mechanisms, or self-healing controls that reduce impact and recovery time.

### Rules of Engagement

- **Explicit Accountability:** Every action item must have a single accountable owner.
- **Issue Association:** Every action item must be linked to an open tracking issue before the postmortem review closes.
- **Resolution SLAs:**
  - `P0` (Critical prevention): Within 7 calendar days.
  - `P1` (High-priority detection or mitigation): Within 14 calendar days.
  - `P2` (Long-term hardening): Prioritized during the next planning cycle or sprint.
- **No Silent Closure:** Action items may not be closed until their implementation and verification mechanism are complete.
- **Change Tracking:** If an action item is deferred, descoped, or its due date changes, the associated tracking issue must be updated with the reason and revised plan.
- **Verification:** Where practical, service owners should verify that the completed action produced the intended improvement.

---

## Lifecycle & Review Timeline

1. **Resolution:** Incident resolved in production.
2. **Within 48 Hours:** The incident commander produces a draft postmortem. If a complete investigation is not yet possible, publish known facts, identified actions, open questions, and the date for completing the review.
3. **Within 5 Business Days:** Maintainers and service owners review findings and validate corrective actions.
4. **Approval & Publication:** The finalized postmortem is approved and recorded in the repository.
5. **Quarterly Audit:** Maintainers review open postmortem actions alongside governance and operational review processes.

---

## Review

This policy must be reviewed:

- When the incident severity model changes materially.
- When the incident response process changes materially.
- When a postmortem identifies a gap in this policy.
- At least annually as part of governance review activities.

Changes follow the governance workflow described in `Governance/README.md` and must remain within the `Governance/` directory.