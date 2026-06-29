# Troubleshooting Guide

Common issues new developers encounter when setting up the TeachLink backend, with causes and fixes.

---

## Database connection errors

### "ECONNREFUSED" or "connect ECONNREFUSED 127.0.0.1:5432"

**Cause:** PostgreSQL is not running or not accessible on the expected port.

**Fix:**

```bash
# Check if PostgreSQL container is running
docker compose ps postgres

# If not running, start it
docker compose up -d postgres

# Check Docker service is running
docker info
```

If using a local PostgreSQL installation:

```bash
# Windows (check service)
Get-Service postgresql*

# If stopped, start it
Start-Service postgresql*
```

### "authentication failed" or "password authentication failed"

**Cause:** `DATABASE_USER` or `DATABASE_PASSWORD` in `.env` does not match the PostgreSQL credentials.

**Fix:**

```bash
# Check current .env values
grep -E "DATABASE_(USER|PASSWORD)" .env

# Verify with psql using those credentials
docker exec -it teachlink-postgres psql -U postgres -d teachlink -c "SELECT 1"
```

### "database does not exist" or "database 'teachlink' not found"

**Cause:** The database specified in `DATABASE_NAME` has not been created.

**Fix:**

```bash
# Create the database inside the container
docker exec -it teachlink-postgres psql -U postgres -c "CREATE DATABASE teachlink;"

# Or let Docker create it on startup (set POSTGRES_DB env var)
```

### "Connection pool exhausted" or "too many clients"

**Cause:** Too many open database connections. The pool may be too large or connections are leaking.

**Fix:**

```bash
# Check active connections
docker exec -it teachlink-postgres psql -U postgres -d teachlink -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
docker exec -it teachlink-postgres psql -U postgres -d teachlink -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';"

# Reduce pool size in .env
# DATABASE_POOL_MAX=10
# DATABASE_POOL_MIN=2
```

---

## Redis connection failures

### "ECONNREFUSED 127.0.0.1:6379"

**Cause:** Redis is not running.

**Fix:**

```bash
# Start Redis via Docker
docker compose up -d redis

# Verify it's healthy
docker compose ps redis
```

### "Redis connection to 127.0.0.1:6379 failed"

**Cause:** `REDIS_HOST` or `REDIS_PORT` in `.env` is incorrect.

**Fix:**

```bash
# Check current settings
grep -E "REDIS_(HOST|PORT)" .env

# Verify Redis is listening on the correct host/port
docker exec -it teachlink-redis redis-cli ping
# Should return: PONG
```

### "NOAUTH Authentication required"

**Cause:** Redis requires a password but `REDIS_PASSWORD` is not set in `.env`.

**Fix:** Add `REDIS_PASSWORD=yourpassword` to `.env` or disable password on the Redis server.

---

## Port conflicts

### "Error: listen EADDRINUSE :::3000"

**Cause:** Another process is already using port 3000.

**Fix:**

```bash
# Windows - find the process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with the actual process ID)
taskkill /PID <PID> /F
```

### Port conflict with PostgreSQL (5432) or Redis (6379)

**Cause:** A local installation of PostgreSQL or Redis is already bound to the default port.

**Fix:**

```bash
# Stop the local service
# PostgreSQL
net stop postgresql-x64-16

# Or change the Docker port mapping in docker-compose.yml:
# ports:
#   - "5433:5432"  # Maps Docker's 5432 to host's 5433
```

---

## Missing environment variables

### "Config validation error: DATABASE_HOST is required"

**Cause:** A required environment variable is missing from `.env`.

**Fix:**

```bash
# Validate your .env
pnpm validate:env

# Copy the example and fill in missing values
cp .env.example .env
```

Common required variables for local development:

| Variable | Typical value |
|----------|--------------|
| `DATABASE_HOST` | `localhost` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `postgres` |
| `DATABASE_PASSWORD` | `postgres` |
| `DATABASE_NAME` | `teachlink` |
| `REDIS_HOST` | `localhost` |
| `REDIS_PORT` | `6379` |
| `JWT_SECRET` | Any string >= 10 chars |
| `JWT_REFRESH_SECRET` | Any string >= 10 chars |
| `ENCRYPTION_SECRET` | Exactly 32 characters |
| `SESSION_SECRET` | Any string >= 10 chars |
| `SMTP_HOST` | `localhost` (can be dummy) |
| `SMTP_PORT` | `1025` |
| `SMTP_USER` | (empty) |
| `SMTP_PASS` | (empty) |
| `EMAIL_FROM` | `noreply@teachlink.local` |
| `AWS_ACCESS_KEY_ID` | Can be placeholder for local dev |
| `AWS_SECRET_ACCESS_KEY` | Can be placeholder for local dev |
| `AWS_S3_BUCKET` | Can be placeholder for local dev |
| `STRIPE_SECRET_KEY` | Placeholder for local dev |
| `STRIPE_WEBHOOK_SECRET` | Placeholder for local dev |
| `SENDGRID_API_KEY` | Placeholder for local dev |

---

## Migration errors

### "Migration failed: relation already exists"

**Cause:** A migration is trying to create a table that already exists (often because `synchronize: true` auto-created it first).

**Fix:**

```bash
# Drop the conflicting table and re-run migration
docker exec -it teachlink-postgres psql -U postgres -d teachlink -c "DROP TABLE IF EXISTS <tablename> CASCADE;"
curl -X POST http://localhost:3000/migrations/run
```

**Prevention:** In development, you can either:
- Use `synchronize: false` and rely entirely on migrations, or
- Accept that `synchronize` handles schema and skip migrations

### "Cannot roll back: later migrations depend on this one"

**Cause:** You're trying to roll back a migration that later migrations depend on.

**Fix:** Roll back the later migrations first, then the target migration.

```bash
# Roll back the last 3 migrations
curl -X POST http://localhost:3000/migrations/rollback/3

# Or reset all (development only)
curl -X DELETE http://localhost:3000/migrations/reset
```

### Migration endpoints return 404

**Cause:** The migration HTTP endpoints may not be wired into the application yet.

**Fix:** Verify tables are created via TypeORM's `synchronize` feature (enabled in development). Check directly in PostgreSQL:

```bash
docker exec -it teachlink-postgres psql -U postgres -d teachlink -c "\dt"
```

---

## Docker issues

### "docker: command not found"

**Cause:** Docker is not installed or not in PATH.

**Fix:** Install Docker Desktop from https://www.docker.com/products/docker-desktop/

### "Cannot connect to the Docker daemon"

**Cause:** Docker Desktop is not running.

**Fix:**

```bash
# Start Docker Desktop
# Windows: Start menu → Docker Desktop
# Then verify:
docker info
```

### "Port 5432 is already allocated"

**Cause:** Another PostgreSQL instance (local install or another container) is using port 5432.

**Fix:**

```bash
# Stop the conflicting container
docker stop <container-name>

# Or use a different port in docker-compose.yml:
# postgres:
#   ports:
#     - "5433:5432"
# Then update .env: DATABASE_PORT=5433
```

### Docker containers exit immediately

**Cause:** The container may be crashing on startup due to misconfiguration.

**Fix:**

```bash
# View container logs
docker compose logs postgres
docker compose logs redis

# Common fixes:
# - Ensure .env has the required variables
# - Check that ports are not in use
# - Ensure enough disk space for Docker volumes
```

---

## Server startup issues

### "Cannot find module '@nestjs/core'"

**Cause:** Dependencies are not installed.

**Fix:**

```bash
pnpm install
```

### "TypeScript compilation errors on startup"

**Cause:** TypeScript code has type errors.

**Fix:**

```bash
# Check for type errors
pnpm typecheck

# Common fixes:
# - Update imports for renamed modules
# - Check for missing type definitions
```

### Server starts but immediately exits

**Cause:** An unhandled error during bootstrap (often database or Redis connection failure).

**Fix:**

```bash
# Check the server logs for the actual error
pnpm start:dev 2>&1 | head -50

# Most common: database not reachable — check step 4 of setup
```

---

## Still stuck?

1. Run the verification script: `pnpm verify`
2. Check the [developer runbook](./runbook.md)
3. Search existing issues: https://github.com/teachlink/backend/issues
4. Ask in the [Telegram community](https://t.me/teachlinkOD)
