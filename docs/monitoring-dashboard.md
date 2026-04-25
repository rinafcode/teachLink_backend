# Monitoring Dashboard

This document describes the Grafana monitoring dashboard for the teachLink
backend, the panels it ships with, and the alerts that fire from it.

The backend exports metrics in Prometheus format from
`src/observability/observability.controller.ts` at:

```
GET /observability/metrics/export/prometheus
```

Prometheus scrapes that endpoint, Grafana visualizes the metrics, and
Alertmanager routes alerts to Slack / PagerDuty.

The full stack (compose file, scrape config, alert rules, provisioned data
source, provisioned dashboard) lives under [`infra/monitoring/`](../infra/monitoring).

---

## 1. Run the stack

```bash
cd infra/monitoring
cp .env.example .env   # fill in SLACK_WEBHOOK_URL / PAGERDUTY_SERVICE_KEY
docker compose up -d
```

| Service | URL | Notes |
| --- | --- | --- |
| Grafana | <http://localhost:3001> | admin / admin on first login |
| Prometheus | <http://localhost:9090> | targets, rules, alerts |
| Alertmanager | <http://localhost:9093> | routing & silences |

The Prometheus container reaches the backend via `host.docker.internal:3000`
(the `host-gateway` mapping in `docker-compose.yml` makes this work on Linux
too). For staging / production, edit
[`infra/monitoring/prometheus.yml`](../infra/monitoring/prometheus.yml) to
point at the real host or k8s service.

The Grafana data source and the _TeachLink Overview_ dashboard are
provisioned automatically from
[`infra/monitoring/provisioning/`](../infra/monitoring/provisioning) — there
is no manual click-through.

---

## 2. Dashboards

The bundled dashboard
([`teachlink-overview.json`](../infra/monitoring/provisioning/dashboards/teachlink-overview.json))
surfaces the four golden signals (latency, traffic, errors, saturation) plus
business KPIs already emitted by `MetricsAnalysisService`.

| Row | Panel | Source metric |
| --- | --- | --- |
| Traffic | Request rate (by status) | `rate(api_requests_total[1m])` |
| Traffic | Request rate (top 10 endpoints) | `sum by (endpoint) (rate(api_requests_total[5m]))` |
| Latency | API latency p50 / p95 / p99 | `histogram_quantile(...)` over `api_response_time_bucket` |
| Errors | 5xx error rate | `api_requests_total{status=~"5.."} / api_requests_total` |
| Health | Service up | `up{job="teachlink-backend"}` |
| Saturation | Node.js event loop lag | `nodejs_eventloop_lag_seconds` |
| Saturation | DB query duration p95 | `database_query_duration_seconds_bucket` |
| Business | User signups / hr | `increase(user_signups_total[1h])` |
| Business | Course enrollments / hr | `increase(course_enrollments_total[1h])` |
| Business | Payments volume (USD) / hr | `increase(payment_amount_usd_total[1h])` |
| Business | Anomalies detected (15m) | `increase(anomalies_detected_total[15m])` |

To edit: open the dashboard in Grafana, click the gear → **Save as JSON**, and
replace the file at
`infra/monitoring/provisioning/dashboards/teachlink-overview.json`. Grafana
re-reads the directory every 30s.

---

## 3. Alerts

Alert rules live in
[`infra/monitoring/alerts.yml`](../infra/monitoring/alerts.yml) and are loaded
by Prometheus on startup.

| Rule | Condition | Severity |
| --- | --- | --- |
| `HighErrorRate` | 5xx ratio > 5% for 5m | critical |
| `HighLatencyP95` | p95 API latency > 1s for 10m | warning |
| `BackendDown` | `up == 0` for 2m | critical |
| `AnomalySpike` | > 10 anomalies in 15m | warning |
| `EventLoopLagHigh` | event loop lag > 200ms for 5m | warning |

Routing
([`alertmanager.yml`](../infra/monitoring/alertmanager.yml)):

- All alerts → Slack `#alerts`.
- `severity=critical` → PagerDuty (in addition to Slack).
- `critical` inhibits matching `warning` alerts on the same service.

Secrets (`SLACK_WEBHOOK_URL`, `PAGERDUTY_SERVICE_KEY`) come from
`infra/monitoring/.env` and are interpolated by docker compose — they are
**not** committed.

### Verify

1. Visit <http://localhost:9090/alerts> — every rule should be **Inactive** on
   a healthy system.
2. Stop the backend; `BackendDown` should transition Pending → Firing.
3. Confirm the alert lands in the configured Slack channel / PagerDuty
   service.

---

## Runbook

When an alert fires:

1. Open the Grafana _TeachLink Overview_ dashboard at the alert's time
   window.
2. Cross-reference the spike with `/observability/anomalies` and recent logs
   via `/observability/logs/search`.
3. For `HighErrorRate`, drill into the per-endpoint panel to find which route
   regressed; check the latest deploy in CI for a likely cause.
4. For `BackendDown`, check pod / container health and Prometheus
   <http://localhost:9090/targets>.

---

## Acceptance

- `docker compose up -d` from `infra/monitoring/` brings Grafana, Prometheus,
  and Alertmanager online.
- Grafana auto-loads the Prometheus data source and the _TeachLink Overview_
  dashboard with live data.
- Prometheus shows the `teachlink-backend` target as `UP` and lists every
  rule in `alerts.yml` under **Alerts**.
- Critical alerts route to PagerDuty; all alerts route to Slack `#alerts`.
