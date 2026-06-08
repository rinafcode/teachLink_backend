# Database Sharding Strategy — TeachLink Backend

> **Issue**: #602 — Implement database sharding strategy  
> **Branch**: `feature/602-database-sharding-strategy`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Sharding Strategies](#2-sharding-strategies)
3. [Architecture](#3-architecture)
4. [Router Implementation](#4-router-implementation)
5. [Connection Management](#5-connection-management)
6. [Migration Strategy](#6-migration-strategy)
7. [Rebalancing Procedure](#7-rebalancing-procedure)
8. [Health Monitoring](#8-health-monitoring)
9. [Configuration Reference](#9-configuration-reference)
10. [API Reference](#10-api-reference)
11. [Runbook](#11-runbook)

---

## 1. Overview

TeachLink uses horizontal database sharding to distribute PostgreSQL load across multiple independent nodes. Each shard is a fully independent PostgreSQL instance holding a subset of the data.

### Why Sharding?

| Challenge                            | Sharding Solution                        |
| ------------------------------------ | ---------------------------------------- |
| Single-node write throughput ceiling | Distribute writes across N shards        |
| Growing dataset storage limits       | Each shard stores only 1/N of the data   |
| Connection pool exhaustion           | Each shard has its own pool              |
| Geographic latency                   | Route tenants to regionally close shards |

### Design Principles

- **Zero-downtime migration** — data moves in batches with source still serving traffic
- **Deterministic routing** — same key always resolves to the same shard (consistent hashing)
- **Graceful fallback** — if `SHARD_COUNT=0`, the system runs on the existing single database
- **Operator-first** — all rebalancing operations are observable and reversible

---

## 2. Sharding Strategies

The system supports four routing strategies selectable per query:

### 2.1 Hash-Based (Default)

Uses a **consistent-hash ring** with 150 virtual nodes per physical shard.

```
key → SHA-256 → uint32 → ring position → shardId
```

**Best for**: User data, course content, generic entities.  
**Pros**: Automatic distribution, minimises key movement on shard add/remove.  
**Cons**: No data locality — related rows may span shards.

### 2.2 Tenant-Based

Normalises the key to its tenant segment before hashing:

```
"tenant:ACME_CORP:course-99" → hash("tenant:ACME_CORP") → shard
```

**Best for**: Multi-tenant SaaS — guarantees all data for a tenant is co-located.  
**Pros**: Cross-tenant joins never cross shard boundaries.  
**Cons**: Uneven distribution if tenants are very different sizes.

### 2.3 Range-Based

Maps numeric ranges to explicit shards:

```
[0, 1_000_000) → shard-00
[1_000_000, 2_000_000) → shard-01
[2_000_000, 3_000_000) → shard-02
```

**Best for**: Time-series data, ordered IDs with predictable growth.  
**Cons**: Requires manual bucket management; hot-spots possible if ranges are uneven.

### 2.4 Read-Replica

Routes **read** queries to a weighted pool of replicas; writes still target the primary.

```
forRead=true → weighted-random pick from shard.readReplicas
```

**Best for**: Read-heavy workloads (dashboards, reports, search pre-fetching).

---

## 3. Architecture

```
Request
  │
  ▼
ShardRouter ──── consistent-hash ring ────► ShardConfig (host, port, pool)
  │                                              │
  │                                              ▼
  │                                   ShardConnectionManager
  │                                    (lazy DataSource cache)
  │                                              │
  │                                              ▼
  │                                    PostgreSQL Shard Node
  │
  ├── for reads ──► ReadReplica (weighted random)
  │
  └── migrations ─► ShardMigrationService ─► ShardRebalanceService
```

### Module Dependency Graph

```
ShardingModule
  ├── ShardConfigService      (loads topology from env)
  ├── ShardRouter             (routing decisions, hash ring)
  ├── ShardConnectionManager  (lazy TypeORM DataSource per shard)
  ├── ShardMigrationService   (cross-shard data movement)
  ├── ShardRebalanceService   (automated / manual rebalancing)
  └── ShardHealthService      (SELECT 1 + pool metrics)
```

---

## 4. Router Implementation

### Consistent-Hash Ring

Each physical shard is represented by **N virtual nodes** placed uniformly on a 0–2³² ring.  
`N = round(150 × weight / 100)` — weight-aware placement.

**Ring lookup (binary search):**

```
keyHash = SHA256(key)[0:4] as uint32
pos     = first virtualNode.position ≥ keyHash  (binary search, wraps to 0)
shardId = ring[pos].shardId
```

Adding a new shard only moves `1/N` of the keyspace — minimising reshuffling.

### Weighted Virtual Nodes

| Shard    | Weight | Virtual Nodes |
| -------- | ------ | ------------- |
| shard-00 | 100    | 150           |
| shard-01 | 100    | 150           |
| shard-02 | 50     | 75            |

shard-02 handles ~25% of traffic vs ~37.5% each for shard-00 and shard-01.

### Ring Rebuild Trigger

The ring is rebuilt automatically on:

- Application startup
- Manual `POST /sharding/ring/rebuild`
- Completion of a rebalance plan

---

## 5. Connection Management

`ShardConnectionManager` maintains a **lazy cache** of TypeORM `DataSource` instances:

```
getConnection(shardId)
  │
  ├── cached & initialized? → return cached DataSource
  │
  └── not cached → new DataSource(shardConfig) → initialize() → cache → return
```

Each DataSource uses the shard-specific pool settings:

- `poolMax` — configurable per shard (default 30)
- `poolMin` — configurable per shard (default 5)
- `connectionTimeoutMillis` — from `DATABASE_POOL_ACQUIRE_TIMEOUT_MS` env var
- `idleTimeoutMillis` — from `DATABASE_POOL_IDLE_TIMEOUT_MS` env var

**Shutdown**: `closeAll()` is called via NestJS lifecycle hooks, gracefully destroying all DataSources before process exit.

---

## 6. Migration Strategy

### 6.1 Migration Flow

```
Operator: POST /sharding/migrations
  {
    "sourceShardId": "shard-00",
    "targetShardId": "shard-01",
    "entityType": "user",
    "estimatedRowCount": 50000,
    "batchSize": 500,
    "dryRun": true          ← validate first
  }
```

**Phase 1 — Dry Run** (always recommended first):

```
SELECT * FROM "user" ORDER BY id LIMIT 500 OFFSET 0
→ Log: "Would insert 500 rows into shard-01" (no writes)
```

**Phase 2 — Live Migration**:

```
LOOP:
  SELECT rows from source  (batch)
  INSERT … ON CONFLICT DO NOTHING into target  (idempotent)
  yield event loop (back-pressure)
ENDLOOP

source shard → DRAINING status
DELETE migrated rows from source
source shard → ACTIVE status
```

### 6.2 Migration Properties

| Property          | Value                                    |
| ----------------- | ---------------------------------------- |
| Idempotent        | ✅ `ON CONFLICT DO NOTHING`              |
| Zero-downtime     | ✅ Source stays up during copy           |
| Back-pressure     | ✅ `setImmediate` between batches        |
| Progress tracking | ✅ `GET /sharding/migrations/:planId`    |
| Rollback          | ✅ `DELETE /sharding/migrations/:planId` |

### 6.3 Pre-Migration Checklist

- [ ] Run dry-run and verify row counts match
- [ ] Verify DDL parity on target shard (same tables / indexes)
- [ ] Confirm target shard has sufficient disk capacity
- [ ] Schedule during low-traffic window
- [ ] Set up monitoring alert on `migration_status != completed`

### 6.4 Rollback

If a migration fails mid-run, `ShardMigrationService` marks it `failed`.  
Rows already copied to the target can be removed by calling:

```
DELETE /sharding/migrations/:planId
```

> ⚠️ This only marks the plan as `rolled_back` in memory. For production, implement an audit log table that records the IDs of all rows copied so that the rollback DELETE can be precise.

---

## 7. Rebalancing Procedure

### 7.1 Automated Rebalancing

The system monitors pool utilisation per shard. When a shard exceeds the **high watermark** (default 80%), migration plans are auto-generated targeting shards below the **low watermark** (default 20%).

```
POST /sharding/rebalance/auto
{
  "entityTypes": ["user", "course"],
  "autoExecute": false     ← dry-run first
}
```

**Review the plan**, then re-submit with `autoExecute: true`.

### 7.2 Manual Rebalancing

For planned splits, merges, or shard decommissions:

```
POST /sharding/rebalance
{
  "dryRun": false,
  "migrations": [
    {
      "sourceShardId": "shard-00",
      "targetShardId": "shard-03",
      "entityType": "course",
      "estimatedRowCount": 100000,
      "batchSize": 1000,
      "dryRun": false
    }
  ]
}
```

### 7.3 Adding a New Shard

1. Provision a new PostgreSQL instance.
2. Run DDL migrations on the new shard (schema must match existing shards).
3. Add `SHARD_N_*` environment variables for the new shard.
4. Rolling restart the application (the ring rebuilds at startup).
5. Monitor via `GET /sharding/health` — the new shard should appear `active`.
6. Optionally run manual rebalance to populate the new shard.

### 7.4 Decommissioning a Shard

1. Set shard status to `DRAINING` via `ShardConfigService.updateShardStatus()`.
2. Migrate all entity types off the shard using `POST /sharding/migrations`.
3. Monitor until all migrations complete.
4. Remove the shard's `SHARD_N_*` environment variables.
5. Rolling restart — the shard disappears from the ring.

---

## 8. Health Monitoring

```
GET /sharding/health
→ [
    {
      "shardId": "shard-00",
      "status": "active",
      "activeConnections": 8,
      "poolUtilizationPercent": 27,
      "avgQueryLatencyMs": 3,
      "errorRatePercent": 0,
      "lastCheckedAt": "2026-05-30T08:00:00Z"
    },
    ...
  ]
```

### Metrics to Alert On

| Metric                   | Warning                 | Critical  |
| ------------------------ | ----------------------- | --------- |
| `poolUtilizationPercent` | > 70%                   | > 90%     |
| `avgQueryLatencyMs`      | > 100ms                 | > 500ms   |
| `errorRatePercent`       | > 1%                    | > 5%      |
| `status`                 | `draining` / `readonly` | `offline` |

---

## 9. Configuration Reference

### Core Sharding Variables

```bash
# Number of shards (0 = single-shard fallback mode)
SHARD_COUNT=3

# Per-shard configuration (repeat for each shard index)
SHARD_0_HOST=pg-shard-0.internal
SHARD_0_PORT=5432
SHARD_0_USER=teachlink
SHARD_0_PASSWORD=<secret>
SHARD_0_DB=teachlink_0
SHARD_0_POOL_MAX=30
SHARD_0_POOL_MIN=5
SHARD_0_WEIGHT=100
SHARD_0_REGION=us-east-1
SHARD_0_STATUS=active

# Read replicas (optional)
SHARD_0_REPLICA_COUNT=1
SHARD_0_REPLICA_0_HOST=pg-replica-0.internal
SHARD_0_REPLICA_0_PORT=5432
SHARD_0_REPLICA_0_WEIGHT=100
```

### Rebalance Thresholds

```bash
SHARD_REBALANCE_HIGH_WATERMARK=80   # % pool utilisation → trigger rebalance
SHARD_REBALANCE_LOW_WATERMARK=20    # % pool utilisation → eligible as target
SHARD_REBALANCE_BATCH_SIZE=500      # rows per migration batch
```

---

## 10. API Reference

| Method   | Path                           | Description                      |
| -------- | ------------------------------ | -------------------------------- |
| `GET`    | `/sharding/shards`             | List all shard configurations    |
| `POST`   | `/sharding/route`              | Resolve shard for a routing key  |
| `GET`    | `/sharding/health`             | Health status of all shards      |
| `GET`    | `/sharding/health/:id`         | Health status of one shard       |
| `POST`   | `/sharding/migrations`         | Start a cross-shard migration    |
| `GET`    | `/sharding/migrations`         | List all migration plans         |
| `GET`    | `/sharding/migrations/:planId` | Get migration status             |
| `DELETE` | `/sharding/migrations/:planId` | Roll back a migration            |
| `POST`   | `/sharding/rebalance`          | Manual rebalance                 |
| `POST`   | `/sharding/rebalance/auto`     | Automated rebalance analysis     |
| `GET`    | `/sharding/rebalance/plans`    | List rebalance plans             |
| `POST`   | `/sharding/ring/rebuild`       | Rebuild the consistent-hash ring |

---

## 11. Runbook

### Runbook: Shard is Offline

```bash
# 1. Check health
curl http://localhost:3000/sharding/health/<shardId>

# 2. Verify PostgreSQL is up on the host
psql -h <host> -U teachlink -d teachlink_N -c "SELECT 1"

# 3. If DB is down, spin it back up or fail over to replica
# 4. Force ring rebuild once shard is healthy
curl -X POST http://localhost:3000/sharding/ring/rebuild
```

### Runbook: Shard is Overloaded

```bash
# 1. Check utilisation
curl http://localhost:3000/sharding/health

# 2. Run auto-rebalance in dry-run mode
curl -X POST http://localhost:3000/sharding/rebalance/auto \
  -H "Content-Type: application/json" \
  -d '{"entityTypes":["user","course"],"autoExecute":false}'

# 3. Review the plan, then execute
curl -X POST http://localhost:3000/sharding/rebalance/auto \
  -d '{"entityTypes":["user","course"],"autoExecute":true}'
```

### Runbook: Emergency Migration Rollback

```bash
# 1. Get the planId from migration list
curl http://localhost:3000/sharding/migrations

# 2. Roll back
curl -X DELETE http://localhost:3000/sharding/migrations/<planId>
```
