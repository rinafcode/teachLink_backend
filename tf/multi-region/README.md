# Multi-Region Deployment & Failover

This Terraform root configuration deploys TeachLink across **two AWS regions** in
an active (primary) / warm-standby (secondary) topology with automated,
health-check driven DNS failover and cross-region data replication.

It composes the single-region modules in [`../modules`](../modules) — nothing is
duplicated — and adds three new modules: `dns-failover`, `replication`, and
`database-replica`.

> Implements issue **#620 — Add multi-region deployment and failover strategy**.

## Architecture

```
                          Route 53 (failover routing)
                          api.teachlink.io
                          ┌────────────┴─────────────┐
                  health check ✓               health check ✗→✓
                          │                            │
              ┌───────────▼───────────┐    ┌───────────▼───────────┐
              │   PRIMARY (us-east-1)  │    │  SECONDARY (us-west-2) │
              │  ALB → ECS (active)    │    │  ALB → ECS (standby)   │
              │  RDS primary (R/W)     │──► │  RDS read replica ─────┼─► promote
              │  Redis primary         │    │  Redis standby         │   on failover
              │  S3 uploads/backups ───┼──► │  S3 uploads/backups    │   (CRR)
              └────────────────────────┘    └────────────────────────┘
```

### What gets created

| Concern              | Primary region          | Secondary region                       |
| -------------------- | ----------------------- | -------------------------------------- |
| Networking           | VPC + subnets + SGs     | VPC + subnets + SGs (non-overlapping)  |
| Compute              | ECS/Fargate + ALB (active) | ECS/Fargate + ALB (warm standby)    |
| Database             | RDS PostgreSQL (R/W)    | Cross-region **read replica**          |
| Cache                | ElastiCache Redis       | Standby Redis (warmed on failover)     |
| Storage              | S3 uploads + backups    | S3 uploads + backups (**CRR target**)  |
| DNS                  | Route 53 failover record + health check | Route 53 failover record + health check |
| Monitoring           | CloudWatch              | CloudWatch                             |

## Acceptance criteria mapping (#620)

- **Multiple deployment regions configured** — `providers.tf` declares aliased
  `aws.primary` / `aws.secondary`; `main.tf` instantiates every stack in both.
- **Failover automation** — `modules/dns-failover` (Route 53 health checks +
  PRIMARY/SECONDARY records) plus [`../../infra/scripts/failover.sh`](../../infra/scripts/failover.sh).
- **Data replication strategy** — `modules/replication` (S3 CRR) +
  `modules/database-replica` (RDS cross-region read replica). See
  [`../../dr/procedures/data-replication.md`](../../dr/procedures/data-replication.md).
- **Testing and runbooks** — [`../../infra/scripts/failover-drill.sh`](../../infra/scripts/failover-drill.sh),
  [`validate-multiregion.sh`](../../infra/scripts/validate-multiregion.sh), and
  [`../../dr/runbooks/multi-region-deployment.md`](../../dr/runbooks/multi-region-deployment.md).

## Usage

```bash
cd tf/multi-region
cp terraform.tfvars.example terraform.tfvars   # edit values

terraform init
terraform fmt -check -recursive
terraform validate
terraform plan  -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

### Prerequisites

- Terraform >= 1.5.0, AWS credentials with permissions in **both** regions.
- For HTTPS, an ACM certificate in **each** region (`*_certificate_arn`).
- A registered domain. Provide `hosted_zone_id` to reuse a zone, or omit it to
  let Terraform create one (then delegate to the output name servers).

## Recovery objectives

| Objective | Target | How this design meets it |
| --------- | ------ | ------------------------ |
| **RTO** | ≤ 15 min | Standby fleet always running; Route 53 fails over automatically within `health_check_interval × failure_threshold` (~90s); replica promotion is the only manual step. |
| **RPO** | seconds (DB), async (S3) | RDS read replica streams continuously; S3 CRR replicates new objects asynchronously. This improves on the backup-only RPO in `dr/procedures/RTO-RPO.md`. |

## Cost & topology notes

- The secondary fleet defaults to a small warm standby (`secondary_desired_count = 1`).
  For true active-active, raise `secondary_desired_count`/`secondary_min_capacity`.
- Route 53 health-check metrics publish only to **us-east-1**; keep
  `primary_region = us-east-1` (default) or adjust the `dns_failover` provider.
- State: configure a remote backend (see [`../README.md`](../README.md)). Use a
  **separate state key** from the single-region config to avoid collisions.

## Failover & failback

Operational procedures live in the DR runbooks:

- [Region Outage runbook](../../dr/runbooks/region-outage.md)
- [Multi-Region Deployment runbook](../../dr/runbooks/multi-region-deployment.md)
- [Failover Plan](../../dr/procedures/failover-plan.md)
- [Data Replication Strategy](../../dr/procedures/data-replication.md)
