# Developer Runbook

Command-driven solutions for the most common day-to-day issues encountered when working on the TeachLink backend.

---

## Fresh install not working

You cloned the repo and followed setup but the server won't start.

### Diagnostics

```bash
# 1. Verify prerequisites
node --version        # Need >= 18
pnpm --version        # Need >= 8

# 2. Check dependencies are installed
ls node_modules/.package-lock.json 2>/dev/null && echo "installed" || echo "missing"

# 3. Check .env exists and has required variables
ls .env && grep -q "DATABASE_HOST" .env && echo "env OK" || echo "env missing or incomplete"

# 4. Run validation
pnpm validate:env

# 5. Run full verification
pnpm verify
```

### Fixes

```bash
# Missing dependencies
pnpm install

# Missing .env
cp .env.example .env
# Edit .env with appropriate values

# Try a clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

## Database not syncing

Tables are missing or the schema doesn't match entities.

### Diagnostics

```bash
# Check database connection
docker exec -it teachlink-postgres psql -U postgres -d teachlink -c "SELECT current_database(), version();"

# List existing tables
docker exec -it teachlink-postgres psql -U postgres -d teachlink -c "\dt"

# Check if TypeORM synchronize is enabled (development default)
grep "synchronize" src/config/database.config.ts
```

### Fixes

```bash
# Option 1: Restart with synchronize (development only)
# In .env, ensure NODE_ENV=development (enables auto-sync)
# Then restart the server

# Option 2: Drop and recreate the database (development only)
docker compose down
docker volume rm teachlink_backend_postgres-data
docker compose up -d postgres redis
# Then start the server — tables will be created on startup

# Option 3: Manually create the database
docker exec -it teachlink-postgres psql -U postgres -c "CREATE DATABASE teachlink;"
```

---

## Redis not connecting

The server logs show Redis connection errors.

### Diagnostics

```bash
# Check Redis container status
docker compose ps redis

# Test connectivity directly
docker exec -it teachlink-redis redis-cli ping

# Check .env values
grep -E "REDIS_(HOST|PORT)" .env
```

### Fixes

```bash
# Start Redis
docker compose up -d redis

# If Redis is running but unreachable, check the host address
# When running the app locally, REDIS_HOST should be localhost (not 'redis')
# When running the app in Docker, REDIS_HOST should be 'redis' (the service name)

# Restart Redis with clean state
docker compose down redis
docker volume rm teachlink_backend_redis-data
docker compose up -d redis
```

---

## Migrations failing repeatedly

Migration commands return errors or the migration API is unreachable.

### Diagnostics

```bash
# Check migration status (requires running server)
curl -s http://localhost:3000/migrations | head -20

# If 404, migration endpoints may not be wired — check database directly
docker exec -it teachlink-postgres psql -U postgres -d teachlink -c "\dt"

# Check for existing schema_migrations or migrations table
docker exec -it teachlink-postgres psql -U postgres -d teachlink -c "\dt" | grep -i migration
```

### Fixes

```bash
# Verify server is running first
curl http://localhost:3000/health

# If migration endpoints aren't available:
# The app uses TypeORM's synchronize in development mode
# Just restart the server and tables will auto-create

# For a full reset (development only):
docker compose down
docker volume rm teachlink_backend_postgres-data
docker compose up -d postgres redis
pnpm start:dev
```

---

## Server won't start

The `pnpm start:dev` command fails immediately.

### Diagnostics

```bash
# Check the actual error
pnpm start:dev 2>&1 | tail -30

# Common patterns:
# "ECONNREFUSED" → Database or Redis not running
# "Cannot find module" → Missing dependencies
# "EADDRINUSE" → Port conflict
```

### Fixes

```bash
# Database/Redis not running
docker compose up -d postgres redis

# Port conflict (e.g., port 3000 in use)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Missing dependencies
pnpm install

# Build artifacts from a different version
pnpm build
```

---

## Tests failing

Unit or E2E tests fail with unexpected errors.

### Diagnostics

```bash
# Run unit tests
pnpm test -- --verbose 2>&1 | tail -40

# Run E2E tests (requires Postgres + Redis)
pnpm test:e2e 2>&1 | tail -40

# Check TypeScript compilation
pnpm typecheck
```

### Fixes

```bash
# If E2E tests fail, ensure services are running
docker compose ps postgres redis

# If tests timeout, increase test timeout
# In test/jest-e2e.json, increase testTimeout

# If TypeScript errors, fix the reported type issues
pnpm typecheck

# Clear Jest cache
pnpm test -- --clearCache
pnpm test:e2e -- --clearCache
```

---

## Lint or format errors

Pre-commit hooks or CI fails due to code style issues.

### Fixes

```bash
# Auto-fix lint errors
pnpm lint

# Check formatting
pnpm format:check

# Auto-format
pnpm format

# Run type checking
pnpm typecheck
```

---

## "Hello World" — Quick validation

Once everything is running, confirm the full stack works:

```bash
# 1. Check health
curl http://localhost:3000/health

# 2. Check API docs are served
curl -s http://localhost:3000/api/docs | head -5

# 3. Check database via API
curl -s http://localhost:3000/migrations

# 4. Verify Redis session store is working
# (Login via the API would create a session)
```

---

## Environment reset — complete fresh start

If you want to wipe everything and start from scratch:

```bash
# Stop everything
docker compose down -v   # -v removes volumes (data is lost!)

# Remove node_modules
rm -rf node_modules

# Remove .env (optional — you'll need to recreate it)
rm .env

# Re-clone
cd ..
rm -rf teachlink_backend
git clone <repo-url>
cd teachlink_backend

# Reinstall
pnpm install
cp .env.example .env
# (edit .env)
docker compose up -d postgres redis
pnpm start:dev
```

---

## Related documentation

- [Setup guide](./setup.md) — full setup instructions
- [Troubleshooting guide](./troubleshooting.md) — common issues
- [Migrations guide](./migrations.md) — migration commands
- [Contributing guide](../CONTRIBUTING.md) — PR workflow
