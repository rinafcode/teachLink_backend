# Setup Guide

Complete step-by-step instructions to get the TeachLink backend running locally.

**Estimated time:** 15-30 minutes

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 18.0.0 | JavaScript runtime |
| pnpm | >= 8.x | Package manager (recommended) |
| Docker | >= 24.x | Running PostgreSQL and Redis |
| Docker Compose | >= 2.24.x | Orchestrating containers |
| Git | >= 2.x | Version control |

**Verify installed versions:**

```bash
node --version      # v18.0.0+
pnpm --version      # 8.x+
docker --version    # 24.x+
docker compose version  # 2.24.x+
git --version       # 2.x+
```

> **pnpm is the primary package manager** for this project. While npm is supported, use pnpm for consistency with CI and the lockfile (`pnpm-lock.yaml`).
>
> Install pnpm: `npm install -g pnpm` (requires npm 9+)

---

## Step 1: Clone the repository

```bash
git clone https://github.com/teachlink/backend.git
cd teachlink_backend
```

---

## Step 2: Install dependencies

```bash
pnpm install
```

This installs all production and development dependencies defined in `package.json`.

---

## Step 3: Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your preferred settings. For local development, these default values work out of the box:

```env
# ─── Core ──────────────────────────────────────
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# ─── Database ──────────────────────────────────
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=teachlink

# ─── Redis ─────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379

# ─── Auth (generate random values for these) ───
JWT_SECRET=dev-jwt-secret-change-me
JWT_REFRESH_SECRET=dev-refresh-secret-change-me
ENCRYPTION_SECRET=12345678901234567890123456789012
SESSION_SECRET=dev-session-secret-change-me

# ─── SMTP (optional for local dev) ─────────────
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@teachlink.local

# ─── AWS (optional for local dev) ──────────────
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_S3_BUCKET=teachlink-local

# ─── Stripe (optional for local dev) ───────────
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder

# ─── SendGrid (optional for local dev) ─────────
SENDGRID_API_KEY=SG.placeholder
```

> **Security note:** Never commit `.env` to version control. The `.env.example` file is the template — always copy it, never modify it in place.

Validate your environment:

```bash
pnpm validate:env
```

---

## Step 4: Start PostgreSQL and Redis

### Option A: Docker (recommended)

Start just the infrastructure services:

```bash
docker compose up -d postgres redis
```

Verify they are healthy:

```bash
docker compose ps
# Both postgres and redis should show "healthy" status
```

### Option B: Local installations

**PostgreSQL (Windows - using Chocolatey):**

```powershell
choco install postgresql
pg_ctl -D "C:\Program Files\PostgreSQL\16\data" start
```

**Redis (Windows - using WSL or Memurai):**

```powershell
# Using WSL
wsl --install -d Ubuntu
wsl sudo apt install redis-server
wsl sudo service redis-server start

# Or install Memurai (Windows-native Redis)
# https://www.memurai.com/
```

---

## Step 5: Create the database

The Docker PostgreSQL container creates the database automatically using `POSTGRES_DB`. If running PostgreSQL natively:

```bash
# Using the Docker container (it auto-creates the DB)
# Or manually via psql:
docker exec -it teachlink-postgres psql -U postgres -c "CREATE DATABASE teachlink;"
```

---

## Step 6: Run database migrations

Migrations are TypeORM `MigrationInterface` classes located in `src/migrations/`.

Start the server (migrations require the running app):

```bash
pnpm start:dev
```

In a second terminal, run pending migrations via the migration API:

```bash
# Run all pending migrations
curl -X POST http://localhost:3000/migrations/run

# Check migration status
curl http://localhost:3000/migrations
```

If migration endpoints are not yet wired, you can verify the database schema is set via TypeORM's `synchronize` (enabled in development):

```bash
# Check that tables were created
docker exec -it teachlink-postgres psql -U postgres -d teachlink -c "\dt"
```

> **Note:** The `getDatabaseConfig()` sets `synchronize: true` in non-production environments, which auto-creates tables from entities. For production, run explicit migrations.

---

## Step 7: Seed data (optional)

If seed scripts exist:

```bash
# Achievement seeds are at src/achievements/achievements.seed.ts
# Run them via the API or CLI when available
```

---

## Step 8: Verify the server is running

```bash
# Health check
curl http://localhost:3000/health

# Expected response: HTTP 200 with status "ok" or similar

# API documentation
open http://localhost:3000/api/docs
```

---

## Step 9: Run the verification script

```bash
pnpm verify
```

This checks:
- Node.js version (>= 18)
- `.env` file exists
- Database connectivity
- Redis connectivity
- Server health endpoint

---

## Step 10: Run the tests

```bash
# Unit tests
pnpm test

# With coverage
pnpm test:cov

# E2E tests (requires Postgres + Redis running)
pnpm test:e2e
```

---

## Available commands

| Command | Description |
|---------|-------------|
| `pnpm start:dev` | Start dev server with hot-reload |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm lint` | Lint and auto-fix |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm validate:env` | Validate environment variables |
| `pnpm migrate:run` | Run pending migrations |
| `pnpm migrate:status` | Check migration status |
| `pnpm verify` | Run setup verification |

---

## Ports and services

| Port | Service | Purpose |
|------|---------|---------|
| 3000 | NestJS API | Application server |
| 5432 | PostgreSQL | Database |
| 6379 | Redis | Caching, sessions, queues |
| 9090 | Prometheus | Metrics (if monitoring stack is up) |
| 3001 | Grafana | Dashboards (if monitoring stack is up) |
| 9200 | Elasticsearch | Search (if monitoring stack is up) |
| 5601 | Kibana | Log search (if monitoring stack is up) |

---

## Next steps

- [Migrations guide](./migrations.md) — detailed migration commands
- [Troubleshooting guide](./troubleshooting.md) — common issues and fixes
- [Developer runbook](./runbook.md) — day-to-day operational guide
- [Architecture docs](./complex-algorithms.md) — system design details
- [Contributing guide](../CONTRIBUTING.md) — how to contribute
