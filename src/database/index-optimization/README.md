# Automatic Database Index Optimizer

PostgreSQL-specific tooling that recommends, creates, monitors and retires
indexes by reading the catalog and the statistics collector (`pg_stat_*`). All
analysis is read-only; the only writes are explicit `CREATE INDEX` /
`DROP INDEX` actions, both gated behind configuration flags.

## Capabilities

| Acceptance criterion              | Component                                   |
| --------------------------------- | ------------------------------------------- |
| Query analysis for recommendations| `QueryAnalysisService.analyze()`            |
| Automatic index creation          | `IndexCreationService`                      |
| Index usage monitoring            | `IndexUsageMonitorService`                  |
| Stale index removal               | `StaleIndexService`                         |
| Scheduled orchestration           | `IndexOptimizationService` (`@Cron` weekly) |

## How recommendations are derived

1. **Foreign-key columns without an index.** Postgres does not automatically
   index FK columns — a frequent cause of slow joins and cascade operations.
   The catalog is queried for FK columns whose leading index columns are not
   already covered, yielding concrete, safe column suggestions.
2. **Sequential-scan activity.** `pg_stat_user_tables` seq/idx scan counts
   score and prioritise the above, and flag heavily seq-scanned tables
   (`HIGH_SEQ_SCAN`).
3. **Slow statements.** When `pg_stat_statements` is installed, slow queries
   are surfaced for context via `GET .../slow-queries`.

Generated DDL uses `CREATE INDEX CONCURRENTLY IF NOT EXISTS` so no long write
lock is taken. After creation the index's `indisvalid` flag is verified; a
failed concurrent build leaves an INVALID index, which is dropped automatically.

## Stale index removal — safety

An index is only eligible for removal when it is **not** a primary key, **not**
unique, **not** backing any constraint, has scan count ≤ `staleMinScans`, and is
larger than `staleMinSizeBytes`. Drops also use `CONCURRENTLY`.

## Configuration (all optional)

| Env var                          | Default | Purpose                                  |
| -------------------------------- | ------- | ---------------------------------------- |
| `INDEX_OPT_ENABLED`              | `false` | Enable the scheduled weekly cycle        |
| `INDEX_OPT_DRY_RUN`              | `true`  | Analyse only; never execute DDL          |
| `INDEX_OPT_AUTO_CREATE`          | `false` | Allow automatic index creation           |
| `INDEX_OPT_AUTO_DROP_STALE`      | `false` | Allow automatic stale-index removal      |
| `INDEX_OPT_SEQ_SCAN_THRESHOLD`   | `1000`  | Min seq scans before a table is a candidate |
| `INDEX_OPT_SEQ_SCAN_RATIO`       | `0.5`   | Min seq/idx scan ratio to flag a table   |
| `INDEX_OPT_SLOW_QUERY_MS`        | `200`   | Mean exec time marking a statement slow  |
| `INDEX_OPT_STALE_MIN_SIZE_BYTES` | `1MB`   | Ignore stale indexes smaller than this   |
| `INDEX_OPT_STALE_MIN_SCANS`      | `0`     | Scans at/below which an index is stale   |
| `INDEX_OPT_MAX_CREATE_PER_RUN`   | `3`     | Cap on indexes created per cycle         |
| `INDEX_OPT_SCHEMA`               | `public`| Schema to operate on                     |

Even with `INDEX_OPT_ENABLED=true`, creation/drops stay in dry-run until you
also set `INDEX_OPT_DRY_RUN=false` and the relevant `AUTO_*` flag.

## API (admin only)

| Method & path                                      | Description                       |
| -------------------------------------------------- | --------------------------------- |
| `GET  /database/index-optimization/recommendations`| Index recommendations             |
| `GET  /database/index-optimization/slow-queries`   | Slow statements (if enabled)      |
| `GET  /database/index-optimization/usage`          | Index usage statistics            |
| `GET  /database/index-optimization/stale`          | Stale indexes eligible for removal|
| `GET  /database/index-optimization/last-run`       | Summary of the last cycle         |
| `POST /database/index-optimization/run?apply=true` | Run a cycle (dry-run unless apply)|

## Wiring

```ts
@Module({
  imports: [
    ScheduleModule.forRoot(), // required for the weekly cron
    IndexOptimizationModule,
  ],
})
export class AppModule {}
```
