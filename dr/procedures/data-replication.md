# Data Replication Strategy

This document describes how TeachLink data is replicated across regions to meet
the recovery objectives in [RTO-RPO.md](./RTO-RPO.md) and enable the failover
flow in [failover-plan.md](./failover-plan.md).

Implemented by [`tf/multi-region`](../../tf/multi-region) — issue **#620**.

---

## Summary

| Data store | Mechanism | Direction | RPO | On failover |
| ---------- | --------- | --------- | --- | ----------- |
| PostgreSQL (RDS) | Cross-region **read replica** | primary → secondary (continuous) | seconds | Promote replica to standalone primary |
| Object storage (S3) | **Cross-Region Replication (CRR)** | primary → secondary (async) | seconds–minutes | Already present in secondary bucket |
| Redis (ElastiCache) | Independent standby (no replication) | n/a | n/a (cache) | Warm standby; repopulates from DB |
| Terraform state | S3 versioning + DynamoDB lock | n/a | n/a | Restore from versioned state |

---

## 1. Database: RDS cross-region read replica

The primary PostgreSQL instance lives in the primary region. A **cross-region
read replica** is provisioned in the secondary region by
[`tf/modules/database-replica`](../../tf/modules/database-replica).

- **How it works**: RDS streams the primary's write-ahead log to the replica
  asynchronously, typically keeping it within a few seconds of the primary
  (`ReplicaLag` metric). This gives an effective **RPO of seconds**, a large
  improvement over the backup-only RPO of up to 7 days.
- **Encryption**: the source is encrypted, so the replica uses a dedicated
  KMS key created in the secondary region (cross-region requirement).
- **Backups**: the replica keeps a 7-day backup retention so it can be promoted
  and itself replicated after a failover.
- **On failover**: `infra/scripts/failover.sh activate` runs
  `aws rds promote-read-replica`, converting the replica into a standalone
  read/write primary. Promotion is irreversible — failback requires re-seeding
  the original primary (see failover-plan.md).

### Monitoring replica lag

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS --metric-name ReplicaLag \
  --dimensions Name=DBInstanceIdentifier,Value=teachlink-prod-db-replica \
  --statistics Average --period 60 \
  --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time   "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --region us-west-2
```

Alert when `ReplicaLag > 5s` (RPO target). The monthly drill
(`infra/scripts/failover-drill.sh`) asserts this automatically.

---

## 2. Object storage: S3 Cross-Region Replication

Both the `uploads` and `backups` buckets replicate from the primary region to
their secondary-region counterparts via
[`tf/modules/replication`](../../tf/modules/replication).

- **Prerequisite**: versioning is enabled on source and destination (the
  storage module already does this).
- **IAM**: a scoped replication role grants S3 permission to read source object
  versions and write them to the destination.
- **Scope**: all objects (`prefix = ""`), including delete markers, so deletes
  propagate.
- **Storage class**: replicated objects land in `STANDARD_IA` to reduce cost.
- **Latency**: replication is asynchronous (usually seconds to minutes). Objects
  written immediately before a regional failure may not have replicated — this
  is the S3 RPO and is acceptable for uploads/backups.

> Note: CRR only replicates objects written **after** the rule is enabled. For a
> brand-new secondary bucket, run a one-time `aws s3 sync` (or S3 Batch
> Replication) to backfill existing objects.

---

## 3. Cache: Redis standby

ElastiCache holds ephemeral cache data, so it is **not** replicated across
regions. The secondary region runs an independent standby Redis cluster that is
empty until failover, after which it repopulates naturally from the promoted
database. This avoids the cost and complexity of a Global Datastore for
non-durable data.

---

## 4. Terraform state

State is stored in a versioned S3 bucket with a DynamoDB lock table (see
[`tf/README.md`](../../tf/README.md)). Versioning provides point-in-time recovery
of the state file itself. Use a **distinct state key** for the multi-region
configuration to avoid clobbering the single-region state.

---

## Verification

| Check | Command / Tool |
| ----- | -------------- |
| Replica exists & lag OK | `infra/scripts/failover-drill.sh` |
| CRR enabled | `aws s3api get-bucket-replication --bucket <bucket>` |
| End-to-end failover | Quarterly drill (see [dr/README.md](../README.md)) |

---

**Document Version**: 1.0
**Owner**: Platform Engineering
**Related**: [failover-plan.md](./failover-plan.md), [RTO-RPO.md](./RTO-RPO.md), [region-outage runbook](../runbooks/region-outage.md)
