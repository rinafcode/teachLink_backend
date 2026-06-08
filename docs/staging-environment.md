# Staging Environment

Staging is a production-parity environment used for final validation before releases. It runs the same service versions, the same configuration shape, and a sanitized copy of production data refreshed daily.

---

## Files

| File | Purpose |
|---|---|
| `.env.staging` | Environment variables – mirrors prod shape, staging-specific values |
| `docker-compose.staging.yml` | Full service stack (app, postgres, redis, elasticsearch, prometheus, grafana, exporters) |
| `scripts/staging/sanitize-and-sync.sh` | Dumps prod DB, sanitizes PII, restores to staging |
| `.github/workflows/staging-sync.yml` | Scheduled (daily 02:00 UTC) and on-demand sync workflow |

---

## Starting the stack

```bash
# Copy and fill in secrets
cp .env.staging .env.staging.local
# edit .env.staging.local with real credentials

docker compose -f docker-compose.staging.yml --env-file .env.staging.local up -d
```

Staging ports are offset by +1 from the default prod ports to allow both stacks to run on the same host:

| Service | Staging port | Prod port |
|---|---|---|
| App | 3000 | 3000 |
| PostgreSQL | 5433 | 5432 |
| Redis | 6380 | 6379 |
| Elasticsearch | 9201 | 9200 |
| Prometheus | 9091 | 9090 |
| Grafana | 3002 | 3001 |
| Redis exporter | 9122 | 9121 |
| Postgres exporter | 9188 | 9187 |

---

## Data sync

### How it works

`scripts/staging/sanitize-and-sync.sh` runs four steps:

1. **Dump** – `pg_dump` from production (plain SQL, no owner/ACL).
2. **Sanitize** – Python3 inline script rewrites PII in the dump:
   - Emails → `user_<sha256[:12]>@staging.invalid` (deterministic, preserves referential integrity)
   - Phone numbers → fake E.164 derived from hash
   - Wallet addresses → fake `0x` address derived from hash
   - Stripe customer/payment IDs → `cus_staging_*` / `pm_staging_*`
   - bcrypt hashes → fixed staging placeholder hash
3. **Recreate** – drops and recreates the staging database.
4. **Restore** – `psql` restores the sanitized dump.

### Running manually

```bash
export PROD_DB_HOST=prod-db.internal
export PROD_DB_PORT=5432
export PROD_DB_USER=teachlink
export PROD_DB_PASSWORD=...
export PROD_DB_NAME=teachlink

export STAGING_DB_HOST=staging-db.internal
export STAGING_DB_PORT=5432
export STAGING_DB_USER=teachlink_staging
export STAGING_DB_PASSWORD=...
export STAGING_DB_NAME=teachlink_staging

bash scripts/staging/sanitize-and-sync.sh
```

Set `KEEP_DUMP=1` to retain the dump files in `/tmp/staging-sync` for inspection.

### Scheduled sync (GitHub Actions)

The workflow `.github/workflows/staging-sync.yml` runs automatically every day at **02:00 UTC**. It can also be triggered manually from the Actions tab with an optional `keep_dump` input.

A `concurrency` group prevents two syncs from running simultaneously. On failure, a Slack notification is sent to `STAGING_SYNC_SLACK_WEBHOOK`.

### Required secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `PROD_DB_HOST` | Production DB hostname |
| `PROD_DB_PORT` | Production DB port |
| `PROD_DB_USER` | Production DB user |
| `PROD_DB_PASSWORD` | Production DB password |
| `PROD_DB_NAME` | Production DB name |
| `STAGING_DB_HOST` | Staging DB hostname |
| `STAGING_DB_PORT` | Staging DB port |
| `STAGING_DB_USER` | Staging DB user |
| `STAGING_DB_PASSWORD` | Staging DB password |
| `STAGING_DB_NAME` | Staging DB name |
| `STAGING_SYNC_SLACK_WEBHOOK` | (Optional) Slack webhook for failure alerts |

---

## Configuration parity

`.env.staging` mirrors every variable in `.env.example` with staging-appropriate values:

- **`NODE_ENV=staging`**
- **`BCRYPT_ROUNDS=12`** – matches the recommended staging range (10–12) from the README security table
- **Database pool** – `DATABASE_POOL_MAX=20 / MIN=5` per the README pool sizing table for staging
- **Feature flags** – identical to production defaults
- **Stripe** – test-mode keys (`sk_test_*`) so no real charges are made
- **Email** – Mailtrap SMTP to intercept outbound email

All `CHANGE_ME_*` placeholders must be replaced with real values before use. Never commit `.env.staging.local` or any file containing real secrets.

---

## Dependency parity

Staging uses the same `package.json` and `package-lock.json` as production. No separate dependency file exists. The Docker image is built from the same `Dockerfile` with `target: production`, ensuring identical Node.js version, installed packages, and build output.

Service image versions in `docker-compose.staging.yml` are pinned to the same tags used in `infra/monitoring/docker-compose.yml`:

- `postgres:16-alpine`
- `redis:7-alpine`
- `elasticsearch:8.13.4`
