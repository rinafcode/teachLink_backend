# Monitoring Stack

Self-contained Prometheus + Alertmanager + Grafana stack for the teachLink
backend. Scrapes the Prometheus exporter served from
`/observability/metrics/export/prometheus`.

See [`docs/monitoring-dashboard.md`](../../docs/monitoring-dashboard.md) for
the full guide and runbook.

## Layout

```
infra/monitoring/
├── docker-compose.yml          # Prometheus + Alertmanager + Grafana
├── prometheus.yml              # Scrape config
├── alerts.yml                  # Alert rules
├── alertmanager.yml            # Alert routing (Slack / PagerDuty)
├── .env.example                # Secrets template — copy to .env
└── provisioning/
    ├── datasources/prometheus.yml      # Auto-wires the data source
    └── dashboards/
        ├── dashboards.yml              # Dashboard provider
        └── teachlink-overview.json     # The default dashboard
```

## Run it

```bash
cd infra/monitoring
cp .env.example .env   # fill in SLACK_WEBHOOK_URL / PAGERDUTY_SERVICE_KEY
docker compose up -d
```

| Service | URL |
| --- | --- |
| Grafana | <http://localhost:3001> (admin / admin) |
| Prometheus | <http://localhost:9090> |
| Alertmanager | <http://localhost:9093> |

The backend must be reachable from the Prometheus container. The default
scrape target is `host.docker.internal:3000`, which works on Docker Desktop
and on Linux thanks to the `host-gateway` mapping in `docker-compose.yml`.
For staging / production, edit `prometheus.yml` to point at the real host.

### Cost panels

This stack includes basic cost tracking panels (Hourly Infrastructure Cost and Estimated Spend 24h) which rely on the backend recording `infrastructure_hourly_cost_usd` metric. This metric must be emitted by the application or an external exporter for alerts to work.

## After it's up

1. Open Grafana → **Dashboards → TeachLink → TeachLink Overview**.
2. Open Prometheus → **Status → Targets** — `teachlink-backend` should be
   `UP`.
3. Open Prometheus → **Alerts** — every rule in `alerts.yml` should be
   listed (`Inactive` on a healthy system).
