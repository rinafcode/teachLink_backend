# Runbook: Multi-Region Deployment & Failover Operations

Operational runbook for the active/standby multi-region topology defined in
[`tf/multi-region`](../../tf/multi-region). Covers initial deployment, routine
verification, manual failover, and failback.

> Related: [Region Outage runbook](./region-outage.md) · [Failover Plan](../procedures/failover-plan.md) · [Data Replication Strategy](../procedures/data-replication.md)

---

## 1. Initial deployment

**Prerequisites**
- Terraform >= 1.5.0; AWS credentials valid in both regions.
- ACM certificates in **each** region (for HTTPS).
- A registered domain (provide `hosted_zone_id` or let Terraform create a zone).

**Steps**
```bash
cd tf/multi-region
cp terraform.tfvars.example terraform.tfvars   # edit values
terraform init
terraform plan  -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

**Post-deploy validation**
```bash
# Static checks (no creds needed)
infra/scripts/validate-multiregion.sh

# Live readiness checks
export PRIMARY_ALB_URL="https://<primary-alb-dns>"
export SECONDARY_ALB_URL="https://<secondary-alb-dns>"
infra/scripts/failover-drill.sh
```
If `hosted_zone_id` was empty, delegate your domain to the
`hosted_zone_name_servers` output before traffic will resolve.

---

## 2. Routine verification (monthly drill)

Run on the **third Tuesday, 02:00 UTC** (see [dr/README.md](../README.md)).

```bash
infra/scripts/failover-drill.sh   # non-destructive; exits non-zero on failure
```
Confirms: both ALBs healthy, replica lag within RPO, S3 CRR enabled.

Record results in the DR drill log. Investigate any ❌ before relying on failover.

---

## 3. Manual failover (primary region lost)

> Route 53 shifts **traffic** automatically when the primary health check goes
> red (~90s). These steps promote the **data tier**, which is not automatic.

1. **Confirm** the outage is regional (AWS Health Dashboard, `failover.sh status`).
2. **Activate**:
   ```bash
   export PRIMARY_REGION=us-east-1 SECONDARY_REGION=us-west-2 ENVIRONMENT=prod
   infra/scripts/failover.sh activate --dry-run   # review
   infra/scripts/failover.sh activate             # execute
   ```
   This promotes the read replica and scales up the secondary ECS service.
3. **Repoint the app**: update `DB_HOST`, `REDIS_HOST`, `AWS_REGION` to the
   secondary endpoints (Terraform outputs `replica_db_endpoint`, etc.) and
   redeploy / restart tasks so writes hit the promoted database.
4. **Verify**: `failover.sh status`; `curl https://api.<domain>/health` → 200;
   confirm DNS resolves to the secondary ALB (`dig +short api.<domain>`).
5. **Communicate** per the [Failover Plan](../procedures/failover-plan.md) comms timeline.

**Target RTO: ≤ 15 min.** Escalate to Platform Lead if exceeded.

---

## 4. Failback (primary region recovered)

Only after the primary is fully restored and **data re-synced** to it.

1. Re-seed the primary database from the promoted secondary (`pg_dump`/restore
   or a new replica in the reverse direction), verify integrity.
2. Re-apply Terraform to restore the primary RDS as a fresh primary and the
   secondary as a read replica again.
3. Scale the secondary back to standby:
   ```bash
   infra/scripts/failover.sh failback
   ```
4. Route 53 returns traffic to the primary once its health check is green.
5. Validate, then document in the post-incident review.

---

## 5. Troubleshooting

| Symptom | Likely cause | Action |
| ------- | ------------ | ------ |
| Traffic not failing over | Health check too lenient / DNS TTL cached | Check `primary_health_check_id` status; wait for interval × threshold |
| Replica promotion fails | Replica mid-update | `aws rds wait db-instance-available`; retry |
| App errors after failover | Still pointing at dead primary | Update `DB_HOST`/`REDIS_HOST`, redeploy |
| S3 objects missing in secondary | Written before CRR enabled, or async lag | One-time `aws s3 sync`; check replication metrics |
| `terraform apply` global-name clash | Reused single-region state | Use a separate state key for `tf/multi-region` |

---

**Document Version**: 1.0
**Owner**: Platform Engineering
**Review**: After each failover drill
