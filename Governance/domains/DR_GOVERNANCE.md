## Summary

Adds `Governance/domains/DR_GOVERNANCE.md`, closing the governance gap noted in #1653 — the `Governance/` folder had no disaster recovery document.

The policy is documentation only and is entirely self-contained in `Governance/` (one file, no application code touched), per the scope rules in `Governance/README.md`.

It records the four things the issue asks for:

- **RTO and RPO targets** — platform level (RTO ≤ 15 min, RPO ≤ 7 days) plus a per-component table (PostgreSQL, Redis, S3, Elasticsearch), matching `dr/procedures/RTO-RPO.md` so the numbers cannot drift.
- **Drill cadence** — the monthly failover drill (third Tuesday, 02:00–04:00 UTC), the five-point checklist, the evidence produced, and the rule that a missed drill is recorded and rescheduled within 14 days rather than skipped.
- **Ownership of DR** — Platform Engineering as owner of record, recorded on the Owner line of `dr/procedures/failover-plan.md`; the recovery role table; the escalation path; and what happens when the owner is unavailable.
- **Verification** — because the change is documentation only there is no runtime behaviour to unit test; the monthly drill is the regression test for the plan, and cross-document numeric consistency is reviewed at every drill.

`DisasterRecoveryService` is referenced as documented in `docs/disaster-recovery.md` rather than as an existing module.

## Scope check

- Files changed: 1 (`Governance/domains/DR_GOVERNANCE.md`) — within the two-file limit.
- No changes outside `Governance/`.

Closes #1653
