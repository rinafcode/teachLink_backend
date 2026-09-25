# Background Job Governance Policy

This document governs how background jobs — work enqueued to run outside the
request/response cycle, such as the queues under `src/queues/` and processors
like `subscription-job.processor.ts` — are named, owned, retried, and made
observable in the TeachLink Backend project.

This policy is part of the project's **Contribution governance** and
**Security & disclosure** areas. It lives entirely inside the `Governance/`
folder and does not change application code.

## Scope

A background job is any unit of work that is enqueued for asynchronous
execution rather than completed inline in the HTTP request that triggered it:
a BullMQ job, a scheduled/cron task, or a processor that consumes from a
queue. This includes, but is not limited to, jobs in `src/queues/`,
`src/notifications/notifications.queue.ts`, and `src/payments/subscriptions/`.

Synchronous work performed entirely within a request handler is out of scope.
Scheduled tasks specifically are governed together with this policy but may
also be covered in more detail by `Governance/domains/CRON_GOVERNANCE.md`
where one exists; this document is authoritative for retry, dead-letter, and
observability requirements shared by both.

## Naming and Ownership Rules

- Job (and queue) names are lower-kebab-case and scoped to the domain that
  owns them, e.g. `notifications:send-email`, `payments:process-subscription`.
  The domain prefix must match the module directory under `src/` that defines
  the job, so ownership is discoverable from the name alone.
- Every queue is declared with a named constant in that module (see
  `src/queues/queues.constants.ts` for the existing convention) rather than a
  string literal scattered across call sites.
- Each job type has exactly one owning module. A module that enqueues a job it
  does not own must go through that job's public API (a service method), never
  by pushing directly onto another module's queue.
- The owning module's `CODEOWNERS` entry (or, absent one, the module's most
  recent primary author) is the point of contact for incidents involving that
  job. See `Governance/domains/SERVICE_OWNERSHIP.md` for the general ownership
  and escalation model this extends.

## Retry and Dead-Letter Policy

- Jobs must declare an explicit retry policy at enqueue time (attempt count
  and backoff strategy); relying on a queue-wide default is not sufficient for
  jobs with side effects that are not naturally idempotent.
- Backoff is exponential with jitter by default, matching the pattern already
  used for webhook delivery (see `Governance/domains/WEBHOOK_GOVERNANCE.md`).
  A fixed-delay retry requires a documented reason in the job's module.
- A job handler must be safe to run more than once for the same logical unit
  of work (idempotent, or de-duplicated via a stable job ID/idempotency key)
  before it is given more than one retry attempt.
- Jobs that exhaust their retries move to a dead-letter queue rather than
  being silently dropped. The dead-letter entry retains the original payload,
  the failure reason, and the number of attempts made.
- Dead-lettered jobs are triaged by the owning module's maintainer within 3
  business days: replayed once the underlying cause is fixed, or explicitly
  discarded with a recorded reason. Dead-lettered jobs are never auto-replayed
  without a human decision.

## Observability Requirement

- Every job emits, at minimum: an enqueue event, a start event, and a
  terminal event (completed, failed, or dead-lettered), each carrying the job
  name, job ID, and queue name so it can be correlated end to end — see
  `src/queues/utils/correlation-job.util.ts` for the existing correlation-id
  convention this must reuse rather than duplicate.
- Queue depth, processing latency, and failure rate are tracked per queue
  (`src/queues/metrics/queue-metrics.service.ts` is the existing home for this
  and must be extended, not bypassed, by new job types).
- A failure event includes enough context (error message, attempt number) to
  diagnose the failure from logs alone, without needing to reproduce it
  locally.
- A sustained rise in dead-lettered jobs or queue depth for a given queue is
  an incident under `src/incident-management/`, not a silent backlog.

## Review

This policy is reviewed whenever a new queue technology is adopted or the
retry/dead-letter model changes materially. Changes are proposed through the
normal governance process described in `Governance/README.md` and must touch
only the `Governance/` folder.
