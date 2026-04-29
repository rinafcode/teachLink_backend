# RTO/RPO Definitions

## Overview

This document defines the Recovery Time Objective (RTO) and Recovery Point Objective (RPO) for the TeachLink backend platform. These metrics guide our disaster recovery strategy and backup frequency.

---

## Key Definitions

### RTO (Recovery Time Objective)
**Definition**: Maximum acceptable time to restore a system to operational status after a failure.

**TeachLink Target**: **≤ 15 minutes**

This means:
- Detection + failover + recovery steps must complete within 15 minutes
- Automated alerts trigger if recovery exceeds this threshold
- Incident severity increases to CRITICAL if RTO is missed

### RPO (Recovery Point Objective)
**Definition**: Maximum acceptable amount of data loss (measured in time before failure).

**TeachLink Target**: **≤ 7 days**

This means:
- Weekly full backups ensure no more than 7 days of data loss in worst case
- We maintain 30 days of backup history for flexibility
- Incremental backup consideration in future roadmap

---

## Component-Level Targets

| Component | RTO | RPO | Backup Method | Frequency |
|-----------|-----|-----|---------------|-----------|
| PostgreSQL Database | 15 min | 7 days | Full pg_dump | Weekly (Sun 02:00 UTC) |
| Redis Cache | 15 min | Immediate | In-memory rebuild | N/A (cache) |
| S3 Media Storage | 30 min | Immediate | Cross-region replication | Continuous |
| Elasticsearch Indices | 30 min | Daily | Index snapshots | Daily @ 03:00 UTC |

---

## Alert Thresholds

### Critical Alerts (CRITICAL Severity)

| Alert | Condition | Action |
|-------|-----------|--------|
| `DISASTER_RECOVERY_RTO_EXCEEDED` | Recovery takes > 15 minutes | Immediate escalation |
| `DISASTER_RECOVERY_FAILED` | All recovery attempts fail | Executive escalation |
| `BACKUP_FAILED` | Scheduled backup fails | Re-attempt + alert |
| `BACKUP_SCHEDULED_FAILED` | All retry attempts exhausted | Manual intervention required |

### Warning Alerts (WARNING Severity)

| Alert | Condition | Action |
|-------|-----------|--------|
| `BACKUP_DELAYED` | Backup delayed > 1 hour | Monitor; may indicate resource issues |
| `RESTORE_SLOW` | Restore takes > 10 minutes | Proceed with caution |

### Informational Alerts (INFO Severity)

| Alert | Condition | Action |
|-------|-----------|--------|
| `DISASTER_RECOVERY_SUCCESS` | Recovery completed within RTO | Document in post-incident review |
| `BACKUP_COMPLETED` | Scheduled backup succeeded | No action needed |

---

## Financial Impact of Downtime

Understanding the cost of downtime helps prioritize recovery efforts.

### Estimated Cost per Minute of Downtime
- **Active Learning**: ~$500/min (users unable to participate)
- **Instructor Dashboard**: ~$200/min (instructors unable to manage courses)
- **Billing System**: ~$1000/min (revenue impact)
- **Data Loss**: Variable (reputation, regulatory fines)

**Example**: 30-minute outage = ~$25,500 direct revenue impact

---

## Capacity Planning for RTO/RPO

### Backup Storage Requirements

```
Weekly full backup size: ~50 GB (PostgreSQL)
Retention: 30 days = 4 full backups
Storage needed: ~200 GB (primary + replicated)
Cost: ~$5/month on AWS S3
```

### Network Capacity for 15-Minute RTO

Recovery requires transferring backup from S3 to primary DB:
- Backup size: 50 GB
- RTO window: 15 minutes = 900 seconds
- Required throughput: 50 GB / 900 s ≈ **56 Mbps**

Current AWS infrastructure supports **1 Gbps**, so this is well within capacity.

### Database Instance Sizing for 15-Minute RTO

Recovery speed depends on database instance type:
- `pg_restore` on db.t3.large: ~8 minutes for 50 GB
- `pg_restore` on db.r5.xlarge: ~4 minutes for 50 GB

**Current commitment**: db.t3.large (sufficient for RTO target)

---

## Compliance & SLA

### Service Level Agreement (SLA) Commitment

TeachLink commits to:
- **99.5% monthly availability** (max 3.6 hours/month downtime)
- **RTO ≤ 15 minutes** for all infrastructure failures
- **Monthly RPO ≤ 7 days**

### Regulatory Requirements

- **Data Protection**: Backups encrypted at rest (AES-256) + in transit (TLS 1.3)
- **GDPR Compliance**: User data restored accurately; audit logs maintained
- **Audit Trail**: All recovery operations logged with timestamps and operator IDs

---

## Monitoring & Metrics

### Key Performance Indicators (KPIs)

Track these metrics monthly:

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Backup completion rate | 100% | — | — |
| Restore success rate | 100% | — | — |
| RTO adherence | 100% | — | — |
| Data integrity verification | 100% | — | — |

### Dashboard Queries

View RTO/RPO metrics in Prometheus:

```promql
# Recovery time histogram
histogram_quantile(0.95, rate(disaster_recovery_duration_seconds_bucket[5m]))

# Backup completion rate
rate(backup_completed_total[1h]) / rate(backup_attempted_total[1h])

# Data age since last backup
backup_age_days
```

---

## Future Enhancements

### Q3 2026 Roadmap

- [ ] Implement incremental backups (reduce RPO from 7 days to 1 day)
- [ ] Point-in-time recovery (PITR) for Postgres (reduce RPO to minutes)
- [ ] Multi-region active/active setup (RTO → 5 minutes)
- [ ] Automated failover without manual intervention (RTO → 1 minute)

### Cost vs. Benefit Analysis

| Enhancement | Cost/Month | RTO Improvement | Priority |
|-------------|-----------|-----------------|----------|
| Incremental backups | $500 | 7d → 1d | Medium |
| PITR implementation | $1000 | 1d → 10min | High |
| Active/active setup | $5000 | 15min → 5min | Medium |

---

## References

- [Failover Plan](./failover-plan.md)
- [Database Failure Runbook](../runbooks/database-failure.md)
- [Region Outage Runbook](../runbooks/region-outage.md)
- [AWS RTO/RPO Guidelines](https://aws.amazon.com/blogs/storage/recovery-objectives-in-aws/)

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-28  
**Owner**: Platform Engineering  
**Review Schedule**: Quarterly
