# SLA and SLO Governance Policy

- **Status:** Active
- **Version:** 1.0.0
- **Owner:** Maintainers & Service Owners (see [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md))
- **Last reviewed:** 2026-09-27
- **Review cadence:** Quarterly, or immediately after a service-level breach

This document governs the service-level objectives (SLOs) and service-level
agreements (SLAs) of the TeachLink Backend platform: which objectives apply to
which services, how each objective is measured from the observability surface
already in the repository, and what happens when one is missed. It exists so
that "is the API healthy enough?" and "have we broken a commitment?" have one
versioned, testable answer rather than being judged by feel during an incident.

This policy is part of the project's **Operations & reliability** area. It
lives entirely inside the `Governance/` folder and does not change application
code.

## 1. Scope

In scope:

- The public HTTP API served by the NestJS application (`src/`).
- The background processing pipeline (queues and workers, `src/queues/`,
  `src/workers/`).
- The data stores the platform depends on for request serving (the PostgreSQL
  connection pool and the Redis cache).
- The alerting and incident machinery that detects and responds to breaches:
  `charts/teachlink-backend/templates/prometheus-rules.yaml`,
  `src/monitoring/alerting/`, and `src/incident-management/`.

Out of scope:

- **Third-party services** the platform depends on (Stripe, SendGrid, SMTP).
  Their availability is governed by
  [`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md). A third-party
  failure that breaches an objective below is still treated as an incident of
  this platform.
- **The Stellar/Soroban rewards contract**, which is maintained in a separate
  repository (see [`SCOPE.md`](../SCOPE.md)).
- **End-user client applications** (Web and Mobile), which live in their own
  repositories.

## 2. Definitions

- **SLI (service-level indicator):** a quantifiable measure of service
  behaviour, derived from the metrics the backend already emits.
- **SLO (service-level objective):** a target range for an SLI over a defined
  window. An SLO is an internal engineering target.
- **SLA (service-level agreement):** the externally communicated commitment
  derived from an SLO. An SLA is never stricter than the SLO that supports it,
  so the team is warned internally before a public commitment is broken.
- **Error budget:** the amount of allowed failure implied by an objective. For
  a 99.0% availability objective over a window, the budget is 1% of requests.
- **Burn rate:** how fast the error budget is being consumed relative to the
  window. A burn rate of 1 consumes the budget exactly over the window; a
  higher rate exhausts it early.

## 3. Service Tiers

Objectives are graded by the impact of a service on users and revenue. A change
to a service's tier follows the normal governance process described in
`Governance/README.md` and is recorded in this document.

| Tier | Services | Rationale |
| --- | --- | --- |
| **Tier 1 — Mission critical** | Authentication and sessions, payments and payouts, the health/API gateway surface | An outage blocks users from signing in or paying; impact is immediate and account- or revenue-blocking. |
| **Tier 2 — Core** | Courses, lessons, enrolments, assessments, webhooks | Degradation is highly visible and degrades the learning experience, but does not block access or payment. |
| **Tier 3 — Deferred** | Notifications, email delivery, search indexing, analytics, gamification | Work can be delayed or retried without immediate user-visible impact. |

## 4. Service Objectives

Each objective is an internal SLO. The published availability SLA is derived
from objective **S1** and is defined in §7. Every target below is expressed in
terms of a metric that already exists in the repository; where a target matches
an existing alert threshold, the source alert is named.

| ID | Applies to | Indicator (SLI) | SLO | Window | Measurement source |
| --- | --- | --- | --- | --- | --- |
| **S1** | All services | HTTP success rate — `1 − (5xx requests / total requests)` | ≥ **99.0%** | Rolling 30 days | `http_request_duration_seconds_count` (`status_code=~"5.."` vs total) |
| **S2** | Tier 1 | HTTP request latency, p99 | ≤ **1 s** | Rolling 7 days | `http_request_duration_seconds_bucket` — matches alert `HighP99Latency` |
| **S3** | Tier 2 / Tier 3 | HTTP request latency, p95 | ≤ **1 s** | Rolling 7 days | `http_request_duration_seconds_bucket` — matches `http_p95_latency_ms` warning rule |
| **S4** | Tier 1 | Payment success rate | ≥ **98%** | Rolling 30 days | `payment_transactions_total` by `status`; alert rule `payment_failure_rate` (warning 2%) |
| **S5** | All services | Database query duration, p95 | ≤ **500 ms** | Rolling 7 days | `db_query_duration_seconds`; alert rule `db_query_duration_ms` (warning 500 ms) |
| **S6** | All services | Database pool utilisation | ≤ **80%** | Rolling 24 hours | `db_pool_utilization`, `db_pool_active_connections`; alert rule `active_connections` (warning 80%) |
| **S7** | All services | Cache hit rate | ≥ **60%** | Rolling 7 days | `cache_hit_rate_percentage`; alert rule `cache_hit_rate` (warning below 60%) |
| **S8** | All services | Queue waiting depth | < **1,000 jobs** | Rolling 1 hour | `queue_waiting_jobs` — matches alert `QueueDepthHigh` |
| **S9** | All services | Dead-letter queue depth | **0 jobs** | Continuous | `queue_failed_jobs_total` and `queue_waiting_jobs` (dead-letter queues) — matches alert `DLQDepthHigh` |
| **S10** | All services | CPU load | < **75%** | Rolling 24 hours | alert rule `cpu_load` (warning 75%) |
| **S11** | All services | Memory usage | < **80%** | Rolling 24 hours | alert rule `memory_usage` (warning 80%) |
| **S12** | All services | Worker restart rate | **0 restarts** | Rolling 24 hours | `worker_restarts_total` |

The thresholds in this table are policy values chosen to align with the
alerting configuration already committed in the repository. Changing a target
is a governance change under §9, not a code change made in passing; changing
the alert threshold that backs it is a code change governed by the owning
service and must keep this document accurate.

## 5. Measurement Method

- **Source of truth.** Every SLI is computed from the Prometheus exposition
  served at `GET /metrics` and scraped every **15 seconds**
  (`infra/monitoring/prometheus.yml`, `global.scrape_interval: 15s`). A
  faster-changing event is not observable more finely than that through this
  surface. The scrape surface and its classification are governed by
  [`PUBLIC_METRICS.md`](../policies/PUBLIC_METRICS.md).

- **HTTP indicators.** The `HttpMetricsMiddleware`
  (`src/monitoring/metrics/http-metrics.middleware.ts`) records every inbound
  request into `http_request_duration_seconds`, labelled by `method`, a
  normalised low-cardinality `route`, and `status_code`. Availability is
  `1 − (requests with a 5xx status / all requests)`. Client errors (`4xx`) are
  excluded from the availability SLI; they measure caller behaviour, not
  service health.

- **Latency indicators.** Latency is read as quantiles from
  `http_request_duration_seconds_bucket` using `histogram_quantile`, over the
  same rate windows the alert rules use. P99 and P95 are distinguished because
  they serve different tiers (§4, S2/S3).

- **Rate and quantile windows.** Availability and error rates are computed with
  `rate(...)` over the window named in §4. Quantiles are computed over the same
  window. Window lengths are part of the objective, not an implementation
  detail: a value that satisfies an objective over 30 days may still breach it
  over 5 minutes, and the fast-burn alerts in §6 deliberately target the short
  window.

- **Resource and pipeline indicators.** Pool, cache, queue, and worker
  indicators are read directly from the gauges and counters in
  `src/monitoring/metrics/metrics-collection.service.ts` and
  `src/queues/metrics/queue-metrics.service.ts`. No new instrumentation is
  introduced by this policy.

- **Exclusions.** The following are excluded from availability calculations at
  the query layer and must never be removed silently:

  - Self-scrape traffic, which is labelled `route="/metrics"`.
  - Requests served during a declared and recorded maintenance window.
  - Synthetic health probes against `GET /health`
    (`src/health-aggregation/`); they are used as a tie-breaker to confirm that
    an availability dip is a real outage, not as the primary SLI.

  A maintenance window is declared through the normal incident/change process
  and recorded with its start, end, and reason. Suppressing an indicator to
  avoid a breach — rather than recording the exclusion — is a governance
  violation, not a measurement option.

- **Record of breaches.** A breach is recorded as an incident in
  `src/incident-management/`. The `Incident.triggerMetrics` field stores the
  breaching value, the threshold, and the alert type, so the qualitative record
  and the numeric measurement stay linked.

## 6. Error Budget

- The error budget for an objective is `(1 − SLO) × valid requests` over the
  objective's window. For S1 (99.0% over 30 days), the budget is **1% of valid
  requests** in the window.
- **Budget consumption is a decision input, not just a fact.** While budget
  remains, teams may ship changes that carry ordinary risk. When the budget is
  exhausted, the affected service freezes non-remediation deployments until the
  budget recovers (see §7, budget exhaustion).
- **Burn is watched at two speeds.** The fast-burn signal is the committed
  Prometheus rules group `teachlink-backend-sla.rules`
  (`charts/teachlink-backend/templates/prometheus-rules.yaml`): a critical alert
  such as `HighErrorRate` (>1% 5xx over 5 minutes) sustained is enough to
  exhaust a 30-day budget in well under a day. The slow-burn signal is a target
  trending toward its limit over the longer window and is handled as a warning
  breach in §7.
- The budget applies per objective. Exhausting the availability budget does not
  freeze work justified solely by a latency objective, and vice versa.

## 7. Breach Response

A breach is any condition where an SLI is outside its objective (§4), or where
the committed alert rules or `ALERT_RULES`
(`src/monitoring/alerting/alerting.service.ts`) fire. Breaches fall into three
classes; the response follows the class.

### 7.1 Breach classes

| Class | Trigger | Owner | Channel | Timeline | Required follow-up |
| --- | --- | --- | --- | --- | --- |
| **Fast burn (critical)** | A critical alert in `teachlink-backend-sla.rules` (`HighErrorRate`, `HighP99Latency`, `DLQDepthHigh`) or a critical `ALERT_RULES` threshold (`PAYMENT_FAILURE_RATE_CRITICAL`, `ACTIVE_CONNECTIONS_CRITICAL`, `MEMORY_USAGE_CRITICAL`, `HTTP_ERROR_RATE_CRITICAL`) | Service primary on-call | PagerDuty, Slack, email via `NotificationAndEscalationService` | Acknowledge within the severity window (critical — 1 minute) | Execute the runbook in `docs/RUNBOOKS.md`; escalate per [`ON_CALL.md`](ON_CALL.md); postmortem per [`POSTMORTEM_POLICY.md`](POSTMORTEM_POLICY.md) when its criteria are met |
| **Slow burn (warning)** | A warning alert (`QueueDepthHigh`, `http_p95_latency_ms`, `db_query_duration_ms`, `active_connections`, `cache_hit_rate`, `cpu_load`, `memory_usage`, `payment_failure_rate`) or a target trending toward its limit | Service owner | Slack, email | Acknowledge within one business day; mitigate before the window closes | Open a tracking issue and record the cause; no postmortem required unless the incident policy is separately triggered |
| **Budget exhaustion** | The cumulative error budget for an objective is consumed before its window ends | Service owner and maintainers | Maintainer group | Freeze the affected service's non-remediation deployments immediately | Mandatory review of the objective and its causes; corrective actions tracked as in the postmortem policy |

### 7.2 Response steps

1. **Detect and attribute.** The alert or the dashboard identifies the
   objective, the breaching value, and the owning service. The owner is the one
   named under [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md).
2. **Acknowledge.** Acknowledgement, not resolution, stops the escalation
   clock, exactly as in [`ON_CALL.md`](ON_CALL.md). An acknowledged but burning
   breach keeps its owner.
3. **Mitigate.** Fast-burn breaches are worked from the matching runbook in
   `docs/RUNBOOKS.md`. A runbook that does not resolve the breach is itself a
   finding to correct.
4. **Escalate when needed.** If the primary owner does not acknowledge within
   the severity window, escalation proceeds through the tiers in
   [`ON_CALL.md`](ON_CALL.md) (T2 secondary, T3 maintainer on duty, T4 full
   maintainer group).
5. **Record.** The incident is recorded in `src/incident-management/` with the
   breaching metric. A breach that meets any criterion in
   [`POSTMORTEM_POLICY.md`](POSTMORTEM_POLICY.md) — including a critical
   severity, a sustained outage of more than 15 minutes, a payment or data
   impact, or three recurrences in 30 days — requires a blameless postmortem.
6. **Close out.** Actions that prevent, detect, or mitigate recurrences are
   tracked to completion under the postmortem policy's action-item rules.

## 8. Regression Tests Where Applicable

This document is a governance-only, documentation-only change. It introduces no
runtime behaviour, no schema change, and no executable code, so it adds no
tests and requires none. Existing lint, typecheck, build, and test suites must
continue to pass, verified by the `validate` job in
`.github/workflows/ci.yml` described in `CONTRIBUTING.md`.

The objectives in §4 are already backed by executable checks that must stay
green and must be updated in the same pull request as any threshold change:

- **Alert rules are present and correct.** `src/monitoring/prometheus-rules.spec.ts`
  asserts that `charts/teachlink-backend/templates/prometheus-rules.yaml`
  defines `HighErrorRate` (>1% over 5m), `HighP99Latency` (>1s over 10m),
  `QueueDepthHigh` (>1,000 over 10m), and `DLQDepthHigh` (>0 over 5m), each with
  a runbook link into `docs/RUNBOOKS.md`.
- **Thresholds evaluate correctly.** `src/monitoring/alerting/alerting.service.spec.ts`
  covers warning/critical evaluation and cooldown behaviour for the
  `ALERT_RULES` thresholds named in §4.
- **Alerts become incidents.** `src/incident-management/tests/incident-detection.service.spec.ts`
  covers the alert-to-incident mapping and consecutive-alert logic that records
  a breach.
- **Runbooks stay complete.** `src/monitoring/prometheus-rules.spec.ts` also
  asserts that every alert rule has a documented mitigation section in
  `docs/RUNBOOKS.md`, so a new SLA alert cannot ship without a response.

Any future change that alters an objective's metric, window, or threshold
updates this document, the backing alert rule, and the corresponding test in
the same change.

## 9. Documenting Changes

- **Policy amendments.** Any change to this policy is submitted as a pull
  request that touches only the `Governance/` folder. A change that adds or
  removes an objective, retiers a service, or alters a target is reviewed
  through the normal governance process in `Governance/README.md` and, where it
  resolves a genuine either-or, recorded in
  [`DECISION_LOG.md`](../DECISION_LOG.md).
- **Code changes that affect an objective.** A change to an alert threshold,
  metric, scrape interval, or runbook that backs an objective (§4–§5) states
  the effect on the objective in its pull request body and keeps this document
  accurate in the same change.
- **Change log.**

| Version | Date | Description of Change |
| --- | --- | --- |
| 1.0.0 | 2026-09-27 | Initial SLA and SLO Governance Policy establishing service tiers, availability, latency, payment, database, cache, queue, resource, and worker objectives; the Prometheus-based measurement method; the error-budget model; and the breach-response and regression-test requirements. |

## 10. Review

This policy is reviewed quarterly, and immediately after any breach that
exhausts an error budget, any change to the service tiers or alerting rules,
and any new service added to the platform. Changes are proposed through the
normal governance process described in `Governance/README.md` and must touch
only the `Governance/` folder.

## 11. Related Documents

- [`SERVICE_OWNERSHIP.md`](SERVICE_OWNERSHIP.md) — the owner accountable for
  each service's objectives.
- [`ON_CALL.md`](ON_CALL.md) — the rotation and escalation tiers a breach
  follows.
- [`POSTMORTEM_POLICY.md`](POSTMORTEM_POLICY.md) — when a breach requires a
  blameless postmortem and how its actions are tracked.
- [`../policies/PUBLIC_METRICS.md`](../policies/PUBLIC_METRICS.md) — which
  metrics are public and how the scrape surface is governed.
- [`BACKUP_POLICY.md`](BACKUP_POLICY.md) and [`DR_GOVERNANCE.md`](DR_GOVERNANCE.md)
  — recovery objectives that complement the availability objectives here.
- [`CRON_GOVERNANCE.md`](CRON_GOVERNANCE.md) and [`JOB_GOVERNANCE.md`](JOB_GOVERNANCE.md)
  — expectations for the scheduled and background work measured by the queue
  and worker objectives.
- [`THIRD_PARTY_INTEGRATION.md`](THIRD_PARTY_INTEGRATION.md) — vetting and
  data-sharing limits for the dependencies outside this policy's scope.
- [`docs/RUNBOOKS.md`](../../docs/RUNBOOKS.md) — the mitigation steps for each
  fast-burn alert.
- [`Governance/README.md`](../README.md) — the governance structure this
  document belongs to.
