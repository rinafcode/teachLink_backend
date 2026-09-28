# Public Metrics Policy

This document defines which metrics the TeachLink Backend exposes through its
numeric scrape endpoints, how often those metrics change, and where each metric
family's data comes from. It exists so that "is this metric public?" has one
written answer instead of being decided per endpoint, and so that adding an
instrumented label cannot silently widen what is exposed.

This policy is part of the project's **Security & disclosure** and
**Contribution governance** areas. It lives entirely inside the `Governance/`
folder and does not change application code.

## Scope

This policy covers the Prometheus-format scrape surface:

- `GET /metrics` — served by `PrometheusController` in
  `src/monitoring/metrics/prometheus.controller.ts`, returning the
  `text/plain; version=0.0.4` exposition format.
- `GET /observability/metrics/export/prometheus` — the legacy alias for the
  same payload.
- `GET /metrics` on the masking KPI registry, served by `MetricsController` in
  `src/utils/masking/metrics.controller.ts`.

Metrics that are only held in memory for internal alert evaluation — the
in-process samples collected by `CustomMetricsService`
(`src/monitoring/custom-metrics.service.ts`) — are **not** part of this surface
unless and until they are registered on a scrape registry. Structured logs and
traces (`src/observability/`) are governed by their own retention rules and are
out of scope here.

## Public by Default

The following are public, aggregate, operational metrics. They contain no
user-identifying labels and may be scraped without special handling:

| Metric family | Kind | Data source |
| --- | --- | --- |
| `http_request_duration_seconds` and API latency histograms | Histogram | HTTP metrics middleware, `src/monitoring/metrics/http-metrics.middleware.ts` |
| API error counters (labelled by route and error code) | Counter | `src/monitoring/metrics/metrics-collection.service.ts` |
| Database query duration and slow-query count | Histogram / Counter | `src/monitoring/metrics/db-metrics.subscriber.ts` |
| Database pool gauges (active, idle, size, max, utilisation, waiting, wait duration) | Gauge / Histogram | `src/monitoring/metrics/db-pool-metrics.collector.ts` |
| Queue depth, active jobs, failed jobs, job processing duration (labelled by queue) | Gauge / Histogram | `src/queues/metrics/queue-metrics.service.ts` |
| Cache hit rate and cache-warming counters/gauges (labelled by cache type) | Gauge / Counter | `src/monitoring/metrics/metrics-collection.service.ts` |
| Aggregate business counters — registrations by user type/source, enrolments by course and status, assessment completions, payment transactions by method and status | Counter / Gauge | `src/monitoring/metrics/metrics-collection.service.ts` |
| KPI gauges — active users by period, cohort retention rate, enrolment conversion rate, payment success rate | Gauge | `src/utils/masking/metrics.service.ts` |
| Node.js runtime metrics from `collectDefaultMetrics` (CPU, memory, event loop lag, GC) | Mixed | `prom-client` via both registries |

## Not Public — Restricted or Internal Only

The following must not be exposed on an unauthenticated scrape. Where they are
instrumented today, the label that makes them sensitive must be dropped or
redacted before the metric is rendered:

- **Any label carrying a user identifier.** `learningPathProgress` is labelled
  by `path_id` *and* `user_id`
  (`src/monitoring/metrics/metrics-collection.service.ts`); the `user_id`
  label must never reach a scrape. Per-user progress is a user-data question,
  not a public metric.
- **Revenue attributed to a named course.** `revenuePerCourseGauge` is labelled
  by `courseId` and `courseName` (`src/utils/masking/metrics.service.ts`).
  Commercial figures are reported through the treasurer's reporting obligations
  (`Governance/roles/TREASURER.md`), not through `/metrics`.
- **Security event counters.** `securityEventsTotal` (labelled by event type)
  is an adversary-useful signal; it is internal-only and alerts on it are
  routed per `Governance/domains/CRON_GOVERNANCE.md` and
  `Governance/domains/JOB_GOVERNANCE.md`'s incident expectations.
- **Any secret, credential, token, connection string, or wallet address**, in
  a label or a metric name. Secrets are never metric labels; see the masking
  layer in `src/utils/masking/`.

The masking layer under `src/utils/masking/` is the enforcement point for the
label-level rules above. A metric family added to a scrape registry is subject
to this classification at review time, not after exposure.

## Update Frequency

- **Scraped values change per scrape.** The bundled Prometheus configuration
  scrapes the backend every **15 seconds**
  (`infra/monitoring/prometheus.yml`, `global.scrape_interval: 15s`), which is
  the effective granularity of every public metric; a faster-changing value is
  not observable more finely than that through this surface.
- **Event-driven counters and histograms** are recorded as the observed event
  happens (a request served, a query executed, a job completed) and are read
  out at the next scrape. Their value between scrapes reflects whatever
  occurred in that window.
- **Gauges** reflect the most recent observation of the underlying quantity,
  refreshed by their collector or middleware rather than recomputed on scrape.
- **Runtime metrics** are sampled by `prom-client`'s `collectDefaultMetrics` at
  its own collection interval and are likewise read out at scrape time.
- Histogram buckets are cumulative over the process lifetime; rate-based
  reporting is the scrape consumer's responsibility, not the endpoint's.

## Data Sources

Every public metric family traces to exactly one of the sources in the tables
above. Two facts about those sources are worth stating explicitly:

- The **scrape registry is the source of truth for what is public**. A metric
  that exists only inside `CustomMetricsService`'s in-memory sample buffer is
  not exposed, and registering it on a registry is the change that makes it
  public.
- **Exporters are not the backend's metric surface.** The `redis` and
  `postgres` jobs in `infra/monitoring/prometheus.yml` scrape
  `redis_exporter` and `postgres_exporter` directly. Metrics obtained from an
  exporter are governed by that exporter's configuration and are outside this
  document's scope.

## Endpoint Access

- By default the scrape endpoint is expected to be reachable only from the
  internal network. Public routing of `/metrics` requires the bearer-token
  protection already implemented by `PrometheusController`: set
  `METRICS_AUTH_TOKEN` (documented in `.env.example` §10, *Metrics &
  Prometheus*) so every scrape must present
  `Authorization: Bearer <token>`.
- `METRICS_ENABLED` and `METRICS_PATH` (`.env.example` §10) control whether the
  endpoint is served and at which path; the routing decision is recorded there,
  not silently in code.
- When the token is unset, access is open — acceptable only for internal
  scraping on a network that is not publicly routed. Moving the endpoint to a
  public address without setting `METRICS_AUTH_TOKEN` is a disclosure
  incident under `src/incident-management/`.

## Review

This policy is reviewed whenever a registry, scrape endpoint, exporter, or
instrumented label changes in a way that could alter what is exposed. Changes
are proposed through the normal governance process described in
`Governance/README.md` and must touch only the `Governance/` folder.
