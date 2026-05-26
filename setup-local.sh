#!/bin/bash
# Setup script for local analytics and cost tracking validation
set -e

# 1. Install dependencies
npm install

# 2. Start backend (in background)
npm run start:dev &
BACKEND_PID=$!
echo "Backend started with PID $BACKEND_PID"

# 3. Start infra monitoring stack
cd infra/monitoring
cp -n .env.example .env || true
docker compose up -d
cd ../../

# 4. Wait for backend to be ready
sleep 10

# 5. Send test analytics event
curl -X POST http://localhost:3000/analytics/event \
  -H 'Content-Type: application/json' \
  -d '{"category":"feature","action":"launch_button_clicked"}'

# 6. Send test cost event
curl -X POST http://localhost:3000/metrics/cost \
  -H 'Content-Type: application/json' \
  -d '{"amountUsd": 5}'

# 7. Print instructions for manual validation
echo "\n---"
echo "Open Prometheus: http://localhost:9090 and search for feature_events_total and infrastructure_hourly_cost_usd."
echo "Open Grafana:   http://localhost:3001 (admin/admin) and view the TeachLink Overview dashboard."
echo "---"
echo "To stop the backend: kill $BACKEND_PID"
