# Scheduled Task Governance Policy

This document governs how scheduled tasks — jobs registered with `@Cron()`
from `@nestjs/schedule`, such as `DataRetentionTask`, `AuditRetentionTask`,
`AnalyticsRetentionTask`, `CacheWarmingScheduler`, and
`DashboardReportScheduler` — are registered, kept idempotent, and monitored
in the TeachLink Backend project.

This policy is part of the project's **Contribution governance** and
**Security & disclosure** areas. It lives entirely inside the `Governance/`
folder and does not change application code.

## Scope

A scheduled task is any unit of work registered to run on a fixed schedule
rather than in response to a request or an enqueued job — in this codebase,
anything annotated with `@Cron()` (or an equivalent `@nestjs/schedule`
decorator such as `@Interval()`/`@Timeout()`). This includes retention purges
under `src/data-retention/`, `src/audit-log/tasks/`, and
`src/analytics/tasks/`, and reporting/warming schedulers such as
`src/dashboard/dashboard-report.scheduler.ts` and
`src/caching/cache-warming.scheduler.ts`.

Background jobs that are enqueued on demand (not run on a fixed schedule) are
governed by `Governance/domains/JOB_GOVERNANCE.md` instead. A task that is
both scheduled and enqueues further work is governed by this document for its
trigger and by that one for the enqueued work itself.

## Registration of Scheduled Tasks

- A scheduled task is defined as its own `Injectable` class named
  `<Domain>Task` or `<Domain>Scheduler`, living in a `tasks/` (or
  `schedulers/` where that is the established convention in the module)
  subdirectory of the domain it belongs to — matching the existing layout
  of `src/data-retention/tasks/data-retention.task.ts` and
  `src/audit-log/tasks/audit-retention.task.ts`.
- The cron schedule is declared with the `CronExpression` enum where a
  standard schedule fits (`EVERY_DAY_AT_3AM` and similar); a raw cron string
  is used only when no standard expression matches, and is commented with
  the schedule it represents in plain language.
- Every task class carries a doc comment stating what it does and when it
  runs, matching the existing `/** Run data purge daily at 3 AM. */` style.
- A new scheduled task is registered through its domain module (added to
  that module's `providers`), never instantiated ad hoc — this keeps the
  full set of scheduled work discoverable from `app.module.ts`'s import
  graph.
- Two tasks must never be scheduled to contend for the same resource at the
  same trigger time (for example, two heavy purge jobs both at 3 AM); new
  tasks are staggered against the existing schedule at review time.

## Idempotency Requirement

- A scheduled task must be safe to run twice in a row, or to run late/miss a
  cycle and catch up, without producing incorrect results or duplicate side
  effects. A purge task that deletes rows matching a condition (as opposed to
  "the next N rows") is naturally idempotent; a task that is not must
  de-duplicate explicitly (a processed-marker column, a distributed lock, or
  an idempotency key).
- Tasks that mutate data record what they did (row counts, in the pattern
  already used by `DataRetentionTask`'s per-step logging) so a re-run's
  effect is auditable after the fact.
- A task must tolerate overlapping invocations gracefully: if a run is still
  in progress when the next trigger fires (a slow purge, a paused process),
  the task either skips the overlapping run or acquires a lock rather than
  running two copies concurrently against the same data.
- Idempotency is verified by the task's own tests (see the project's unit
  test conventions), not asserted only in this document.

## Monitoring Requirement

- Every scheduled task logs a start and a completion (or failure) event,
  including what it did (counts, duration) so a missed or failed run is
  visible in logs without needing to reproduce it.
- A task that fails must not fail silently: the failure is logged at error
  level and, for tasks with a compliance or security impact (retention
  purges, audit-log tasks), raised as an incident per
  `src/incident-management/` if it fails repeatedly.
- A task that has not run within its expected window (schedule drift, the
  process being down at trigger time) is itself a signal worth alerting on
  for tasks whose absence has compliance impact — retention and audit-log
  tasks fall in this category and are prioritised first when this
  monitoring is implemented.
- Scheduled-task health is reviewed alongside queue health under
  `Governance/domains/JOB_GOVERNANCE.md`'s observability requirement, so the
  two are monitored consistently rather than as separate concerns.

## Review

This policy is reviewed whenever a new scheduling mechanism is adopted or the
idempotency/monitoring expectations change materially. Changes are proposed
through the normal governance process described in `Governance/README.md`
and must touch only the `Governance/` folder.
