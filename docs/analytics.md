# Analytics & Cost Tracking

This document describes the lightweight analytics and cost-tracking additions.

Endpoints:

- POST /analytics/event - record a feature event (body: { category, action, label?, value? })
- GET /monitoring/cost/summary - returns last 24h estimated spend and avg hourly cost if enabled

Metrics added (Prometheus):

- feature_events_total{category,action} - counter for feature events
- infrastructure_hourly_cost_usd - gauge for current hourly cost (USD)

Dashboard:

- The Grafana TeachLink Overview dashboard includes panels for hourly cost and 24h spend.
