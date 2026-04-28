# Failover Plan

## Overview

This document describes the failover procedures for TeachLink in the event of a regional outage or primary component failure. It covers failover strategies, infrastructure requirements, and failback procedures.

---

## Architecture & Redundancy

### Primary Region: us-east-1
- **PostgreSQL**: Primary database (read/write)
- **Redis**: Primary cache layer
- **NestJS API**: Primary compute resources
- **S3**: Primary backup storage

### Secondary Region: us-west-2
- **S3 Replication**: Cross-region replicated backups
- **Standby Database**: Empty instance (provisioned on-demand)
- **Standby API**: Auto-scaling group (scale-to-zero, activate on demand)

### Cross-Region Components
- **Route 53**: DNS with active-passive failover
- **CloudFront**: Edge distribution (cache minimizes latency post-failover)
- **KMS Keys**: Replicated encryption keys in both regions

---

## Failover Scenarios & Procedures

### Scenario 1: Database Component Failure (Primary Region OK)

**Symptoms**:
- API returns 500 errors for database queries
- Health check: `GET /health` returns `"database": "down"`
- Error logs show PostgreSQL connection refused

**Detection Time**: < 2 minutes (automated health check)

**Failover Procedure**:

```
Step 1: Detect database failure
├─ Automated health checks detect service down
└─ PagerDuty alert: DISASTER_RECOVERY_FAILED (CRITICAL)

Step 2: Assess scope
├─ Check PostgreSQL logs for root cause
├─ Confirm it's pod/instance failure (not network)
├─ Verify S3 backups are accessible

Step 3: Initiate restore
├─ Call POST /backup/restore/:backupId (latest verified backup)
├─ Monitor logs: "Starting disaster recovery restore"
└─ Expected duration: 4-8 minutes (50GB on db.t3.large)

Step 4: Validate recovery
├─ Query: GET /health (should show "database": "ok")
├─ Smoke tests: curl /api/courses (verify responses)
├─ Check replica lag in CloudWatch

Step 5: Resume operations
├─ Manually re-trigger any missed cron jobs
├─ Clear Redis cache if needed
└─ Monitor error rates for 15 minutes
```

**RTO**: 8-12 minutes  
**RPO**: Up to 7 days (latest backup)

---

### Scenario 2: Primary Region Outage (Catastrophic Failure)

**Symptoms**:
- All services unreachable from global healthcheck
- AWS Console shows regional incident message
- Route 53 health check fails for all endpoints in us-east-1

**Detection Time**: 1-2 minutes (health check frequency)

**Failover Procedure**:

```
Step 1: Confirm regional outage
├─ AWS Status Page shows incident
├─ Ping/curl endpoints from multiple regions fail
├─ CloudWatch shows 0% availability

Step 2: Activate secondary region failover
├─ PagerDuty escalates to Platform Lead
├─ Manual trigger: Run failover script
│   aws failover activate --source=us-east-1 --target=us-west-2
├─ Script actions:
│   ├─ Provision db.t3.large instance in us-west-2
│   ├─ Restore from latest backup (us-west-2 S3 bucket)
│   ├─ Update Route 53 DNS to us-west-2 ELB
│   ├─ Scale up NestJS pods in us-west-2
│   └─ Verify health checks green in new region

Step 3: Updates to deployment
├─ Environment variables updated:
│   ├─ DB_HOST → new us-west-2 RDS endpoint
│   ├─ AWS_REGION → us-west-2
│   ├─ BACKUP_PRIMARY_REGION → us-west-2
│   └─ REDIS_HOST → us-west-2 ElastiCache
├─ Redeploy application pods (10-15 pods × ~30s each = 5 min)

Step 4: Validate failover
├─ Health checks green for us-west-2 (3+ checks in 2 min)
├─ Route 53 DNS resolves to us-west-2 ELB
├─ Global CDN/CloudFront cache still serving stale content (OK for first 5 min)
├─ Manual smoke test from us-west-2: all endpoints respond

Step 5: Communication
├─ Send statuspage.io update
├─ Notify customers: "Service restored; working from us-west-2"
├─ Post #incidents Slack: RTO = X minutes, RPO = 7 days
```

**RTO**: 12-15 minutes  
**RPO**: Up to 7 days  
**Estimated Cost**: $200 additional infrastructure (temporary us-west-2 resources)

---

### Scenario 3: Regional Infrastructure Degradation (50% Capacity)

**Symptoms**:
- Services responding slower (p99 latency > 5 seconds)
- Some pods failing to start (insufficient capacity)
- AWS Console shows capacity warnings

**Detection Time**: 5-10 minutes (performance monitoring)

**Failover Procedure**:

```
Step 1: Assess capacity situation
├─ Check CPU/memory utilization in CloudWatch
├─ Verify pods are not OOMKilled
├─ Confirm no hung database connections

Step 2: Pre-failover preparation
├─ Do NOT trigger full failover yet
├─ Drain traffic from most-impacted AZs
├─ Scale up reserved capacity in us-east-1
├─ Monitor for 5 minutes to confirm one-region recovery possible

Step 3: If degradation continues → full failover
├─ Follow Scenario 2 procedure above
└─ Escalate to us-west-2 deployment

Step 4: Gradual load-balancing
├─ If situation improves while failover in progress:
│   ├─ Keep us-west-2 as active backup
│   ├─ Do NOT immediately fail back (risky)
│   ├─ Monitor for 1 hour post-recovery
│   └─ Plan controlled fail-back in business hours
```

**RTO**: 10-20 minutes (depending on root cause)  
**RPO**: Minimal (no backup needed if infrastructure recovers)

---

## Infrastructure Requirements for Failover

### Pre-requisites

For failover to execute within RTO target:

| Component | Requirement | Cost | Status |
|-----------|------------|------|--------|
| Secondary S3 bucket | us-west-2 with cross-region replication | $50/mo | ✅ Active |
| Standby RDS snapshot | Latest backup accessible in us-west-2 | $100/mo storage | ✅ Active |
| Route 53 health checks | 30-second interval, multi-region | $20/mo | ✅ Active |
| Network capacity | 1 Gbps between regions | Included | ✅ Active |
| Deployment automation | Failover scripts in `/infra/scripts/failover.sh` | Operational | ✅ Ready |

### Auto-Scaling Groups Configuration

**us-east-1 (Primary)**
```yaml
Min: 3 pods
Max: 20 pods
Desired: 10 pods (normal) → 15 pods (scaling)
```

**us-west-2 (Secondary)**
```yaml
Min: 0 pods (standby; scale-to-zero on recovery)
Max: 20 pods
Desired: 0 pods (standby) → 10 pods (activated)
```

### Database Instance Capacity

```yaml
Primary (us-east-1):
  Class: db.t3.large
  Storage: 200 GB gp3
  Multi-AZ: Enabled

Secondary (us-west-2):
  Class: db.t3.large (provisioned only on failover)
  Storage: 200 GB gp3
  Multi-AZ: Will enable post-failover
```

---

## Failback Procedure (Return to Primary Region)

**Timeline**: Execute only AFTER primary region fully recovered (typically 4-24 hours post-incident)

### Phase 1: Pre-Failback Validation (4-8 hours after regional recovery)

```
1. AWS confirms primary region fully restored
   └─ No ongoing incident, full capacity online

2. Verify continuity on secondary
   ├─ All health checks passing in us-west-2
   ├─ No data corruption detected
   ├─ All scheduled tasks functioning

3. Backup current state
   └─ Take snapshot of us-west-2 DB (safety measure)

4. Senior platform engineer approval required
   └─ Failback is high-risk; schedule during business hours
```

### Phase 2: Data Synchronization (30 minutes)

```
1. Sync from us-west-2 (active) to us-east-1 (inactive)
   ├─ pg_dump us-west-2 database
   ├─ Restore to us-east-1 primary
   └─ Verify data integrity

2. Update replication configuration
   └─ Resume backup replication to us-west-2 (standby)
```

### Phase 3: Route 53 Failback (5-10 minutes)

```
1. Update Route 53 DNS
   ├─ Primary: us-east-1 (health check weight = 100%)
   ├─ Secondary: us-west-2 (health check weight = 0%)
   └─ Wait for TTL cache expiration (5 min)

2. Monitor traffic shifting
   ├─ Observe p99 latency; should decrease
   └─ Watch error rate; should remain at 0%

3. Scale down us-west-2 standby
   └─ Remove pods from us-west-2
```

### Phase 4: Validation & Cleanup (15 minutes)

```
1. Run smoke tests from multiple regions
   └─ Confirm us-east-1 primary is responsive

2. Decommission us-west-2 temporary resources
   ├─ Terminate RDS instance (if not part of standard HA setup)
   ├─ Scale ASG to 0 pods
   └─ Retain backup snapshots for 48 hours

3. Document failover/failback in post-incident review
```

**Total Failback Time**: 2-3 hours (mostly waiting for propagation)

---

## Automated Failover Scripts

### Activate Failover

Location: `/infra/scripts/failover.sh`

```bash
#!/bin/bash
# Usage: ./failover.sh activate

set -e

SOURCE_REGION="us-east-1"
TARGET_REGION="us-west-2"

echo "Starting failover from $SOURCE_REGION to $TARGET_REGION..."

# 1. Provision resources
echo "Provisioning RDS instance in $TARGET_REGION..."
aws rds create-db-instance --region $TARGET_REGION \
  --db-instance-identifier teachlink-db-failover \
  --db-instance-class db.t3.large ...

# 2. Restore from backup
echo "Restoring from backup..."
aws rds restore-db-instance-from-db-snapshot \
  --region $TARGET_REGION \
  --db-instance-identifier teachlink-db \
  --db-snapshot-identifier teachlink-backup-latest ...

# 3. Update Route 53
echo "Updating DNS..."
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch file://failover-dns.json

# 4. Scale services
echo "Scaling us-west-2 deployment..."
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name teachlink-api-west \
  --desired-capacity 10 --region $TARGET_REGION

echo "Failover activation complete!"
```

### Failback to Primary

Location: `/infra/scripts/failover.sh`

```bash
# Usage: ./failover.sh failback

# 1. Sync data from us-west-2 to us-east-1
# 2. Update Route 53 (switch traffic back)
# 3. Scale down us-west-2
# 4. Verify health
```

---

## Monitoring During Failover

### Key Metrics to Watch

| Metric | During Failover | Target | Alert If |
|--------|---|--------|-----------|
| Route 53 health check status | 🔴→🟢 | Green | Stays red > 2 min |
| API error rate (4xx/5xx) | 0% (target) | 0.1% | > 1% |
| Database connection latency | 50-200ms | < 100ms | > 500ms |
| Replication lag | N/A | < 1 second | > 5 sec |

### Alerting Rules

```yaml
AlertRule: FailoverInProgress
  Condition: route53_health_check_status == RED for 30 seconds
  Action: 
    - PagerDuty escalate to CTO
    - Slack: #incidents

AlertRule: FailoverExceededRTO
  Condition: time_since_outage_start > 15 minutes AND service_not_recovered
  Action:
    - PagerDuty escalate to CTO + AWS Support
    - Slack: #incidents + #exec
```

---

## Communication Plan

### Timeline for Stakeholder Updates

| Time | Audience | Message | Channel |
|------|----------|---------|---------|
| T+0 (outage detected) | Internal team | Incident detected, investigating | #incidents |
| T+3 min | Customers | Service unavailable; working on it | statuspage.io |
| T+8 min | Executive team | Regional outage; activating failover | email + #exec |
| T+13 min | All stakeholders | Service restored (failover complete) | statuspage.io + email |
| T+60 min | All | Summary of incident + RCA timeline | statuspage.io |

---

## Testing Failover Procedures

### Monthly Failover Drill

**Schedule**: Third Tuesday of month, 2-4 AM UTC (off-peak)

**Procedure**:
1. Take backup of us-east-1 DB
2. Run failover script against staging environment
3. Verify failover completes within 15 minutes
4. Execute smoke tests in failover region
5. Document any slowdowns or issues
6. Failback and verify data integrity

**Success Criteria**:
- [ ] Failover activates without manual intervention
- [ ] RTO < 15 minutes
- [ ] All health checks green in target region
- [ ] Zero data loss
- [ ] All smoke tests pass

---

## References

- [RTO/RPO Definitions](./RTO-RPO.md)
- [Database Failure Runbook](../runbooks/database-failure.md)
- [Region Outage Runbook](../runbooks/region-outage.md)
- AWS Failover Architecture: https://aws.amazon.com/blogs/architecture/

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-28  
**Owner**: Platform Engineering  
**Review Schedule**: Monthly (after failover drill)
