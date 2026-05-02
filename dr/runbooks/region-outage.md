# Region Outage Runbook

## Quick Reference

| Metric | Value |
|--------|-------|
| **Alert**: | AWS_REGION_OUTAGE or ALL_SERVICES_UNREACHABLE |
| **RTO**: | ≤ 15 minutes to failover region |
| **RPO**: | ≤ 7 days (latest backup) |
| **Escalation**: | On-call Engineer → Platform Lead → CTO (immediate) |

---

## Symptoms & Detection

### Symptom 1: All Services Unreachable

**Observable Indicators**:
```
curl https://api.teachlink.local → Connection timeout (after 30s)
curl https://app.teachlink.local → Connection timeout
Healthcheck from us-west-2 → All failing
No response to any region
```

**Root Causes (in order of likelihood)**:
1. AWS region us-east-1 complete power outage
2. Network partition between region and internet
3. All availability zones (AZs) in us-east-1 down
4. Load balancer/ingress unreachable
5. DNS resolution failure (Route 53 issue)

### Symptom 2: AWS Status Page Indicates Incident

```
Check: https://status.aws.amazon.com/
Look for: 
  ❌ us-east-1 showing "Service Degradation" or "Service Disruption"
  ❌ Multiple AWS services affected (EC2, RDS, S3, etc.)
  ❌ No ETA provided or ETA > 2 hours
```

### Symptom 3: Alerts in Monitoring

**PagerDuty alerts that trigger this runbook**:
- `AWS_REGION_OUTAGE` (CRITICAL, auto-acknowledged)
- `ALL_SERVICES_UNREACHABLE` (CRITICAL)
- `ROUTE_53_FAILOVER_TRIGGERED` (CRITICAL)
- `GLOBAL_HEALTHCHECK_FAILING` (CRITICAL)

---

## Initial Assessment (< 2 minutes)

### Step 1: Confirm Regional Outage

```bash
# Check AWS Status Page
curl -s https://status.aws.amazon.com/index.json | \
  jq '.incidents[] | select(.created_at > now | -3600) | {title, status}'

# Alternative: Check AWS Console directly
# https://console.aws.amazon.com/personal-dashboard
# Look for incident banners at top
```

**Expected output on outage**:
```json
{
  "title": "AWS Region us-east-1 service disruption",
  "status": "investigating",
  "impact": "Significant service disruption"
}
```

### Step 2: Verify All Endpoints Are Down

```bash
# Test from multiple regions
for region in us-east-1 us-west-2 eu-west-1; do
  echo "Testing from $region..."
  curl -s --connect-timeout 5 https://api.teachlink.local/health || echo "FAILED"
done

# If all return timeouts/connection errors → Confirmed region outage
# If some succeed → Not a region outage; use Database Failure runbook
```

### Step 3: Assess Customer Impact

```bash
# Check error reporting from CDN (Cloudflare/CloudFront)
# Look for spike in error rates in last 2 minutes

# Estimate users affected:
# - Active sessions in us-east-1: ~85% total
# - Estimated impact: 10,000-15,000 concurrent users
# - Revenue impact: ~$500/minute

echo "Region outage confirmed. Initiating failover to us-west-2..."
```

---

## Failover Execution (12-15 minutes)

### Step 1: Emergency Escalation (30 seconds)

```bash
# IMMEDIATE: Page on-call Platform Lead and CTO
# This is a CRITICAL incident requiring top-level engagement

# Send notification
pagerduty trigger "Region Outage: Initiated Failover" \
  --urgency critical \
  --account platform-lead,cto

# Slack notification
curl -X POST $SLACK_WEBHOOK_URL \
  -d '{"text":"🚨 CRITICAL: AWS us-east-1 outage detected. Initiating automatic failover to us-west-2.", "channel":"#incidents"}'
```

### Step 2: Verify Failover Prerequisites (1 minute)

Before executing failover, confirm:

```bash
# Check secondary region (us-west-2) is healthy
aws ec2 describe-regions --region-names us-west-2 --query 'Regions[0].OptInStatus'

# Check S3 backup is accessible from us-west-2
aws s3 ls s3://teachlink-backups-west/ --region us-west-2

# Check latest backup
aws s3 ls s3://teachlink-backups-west/ --region us-west-2 | tail -1
# Should show: backup-YYYY-MM-DD-HHMMSS.sql.gz

# Confirm current Route 53 weight (should be us-east-1 = 100%)
aws route53 list-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --query 'ResourceRecordSets[?Name==`api.teachlink.local.`]'
```

### Step 3: Provision Secondary Region Resources (3-4 minutes)

```bash
# Run automated failover script
cd /infra/scripts
./failover.sh activate \
  --source-region us-east-1 \
  --target-region us-west-2 \
  --backup-id backup-latest \
  --failover-type catastrophic

# Script executes:
# 1. Create RDS instance in us-west-2 (if doesn't exist)
# 2. Restore from latest backup
# 3. Provision 10 pods in us-west-2
# 4. Update Route 53 DNS
```

**What the failover script does**:

```bash
#!/bin/bash
# Failover automation script (simplified)

echo "Step 1: Provision RDS in us-west-2..."
aws rds create-db-instance --region us-west-2 \
  --db-instance-identifier teachlink-db \
  --db-instance-class db.t3.large \
  --allocated-storage 200 \
  --engine postgres \
  --master-username postgres \
  --master-user-password $(aws secretsmanager get-secret-value --secret-id db-password --query SecretString) \
  --storage-encrypted \
  --publicly-accessible false

# Wait for RDS to be available (takes ~5 minutes)
aws rds wait db-instance-available --region us-west-2 --db-instance-identifier teachlink-db

echo "Step 2: Restore from backup..."
# Get latest backup snapshot
SNAPSHOT=$(aws s3 ls s3://teachlink-backups-west/ --region us-west-2 | tail -1 | awk '{print $NF}')

# Restore to RDS
pg_restore -h teachlink-db.us-west-2.rds.amazonaws.com \
           -U postgres \
           -d teachlink \
           -j 4 \
           <(aws s3 cp s3://teachlink-backups-west/$SNAPSHOT - --region us-west-2 | gunzip)

echo "Step 3: Update environment & deploy..."
kubectl set env deployment/api \
  -n production \
  DB_HOST=teachlink-db.us-west-2.rds.amazonaws.com \
  AWS_REGION=us-west-2 \
  BACKUP_PRIMARY_REGION=us-west-2 \
  --record

echo "Step 4: Scale deployment in us-west-2..."
kubectl scale deployment api -n production --replicas=10
kubectl rollout status deployment/api -n production

echo "Step 5: Update Route 53 DNS..."
# Update DNS to point to us-west-2
# Primary (us-east-1): weight = 0
# Secondary (us-west-2): weight = 100
```

### Step 4: Monitor Failover Progress (2-3 minutes)

**Watch these indicators**:

```bash
# Terminal 1: Watch Route 53 DNS changes
watch -n 5 "dig +short api.teachlink.local"

# Terminal 2: Monitor pod deployment
kubectl rollout status deployment/api -n production --watch

# Terminal 3: Check health endpoint
watch -n 5 "curl -s http://api.teachlink.local/health | jq '.status'"

# Expected progression:
# T+0s:   DNS still points to us-east-1 (no response)
# T+30s:  pods starting to stand up in us-west-2 
# T+60s:  initial pods healthy, but limited capacity
# T+120s: all pods healthy
# T+150s: DNS updated to us-west-2
# T+180s: All users now reaching us-west-2
```

### Step 5: DNS Failover (2-3 minutes)

```bash
# Option A: Automatic Route 53 failover
# (If configured with health checks, this should happen automatically)

# Option B: Manual Route 53 update
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch '{
    "Changes": [
      {
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": "api.teachlink.local",
          "Type": "A",
          "SetIdentifier": "primary-us-east-1",
          "Failover": "PRIMARY",
          "Weight": 0,
          "AliasTarget": {
            "HostedZoneId": "Z...",
            "DNSName": "elb-us-east-1...",
            "EvaluateTargetHealth": true
          }
        }
      },
      {
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": "api.teachlink.local",
          "Type": "A",
          "SetIdentifier": "secondary-us-west-2",
          "Failover": "SECONDARY",
          "Weight": 100,
          "AliasTarget": {
            "HostedZoneId": "Z...",
            "DNSName": "elb-us-west-2...",
            "EvaluateTargetHealth": false
          }
        }
      }
    ]
  }'

# DNS propagation takes 1-2 minutes
# TTL is set to 60 seconds, so most clients migrate within 2 min
```

---

## Verification (< 3 minutes)

### Check 1: DNS Resolution

```bash
# Verify DNS now points to us-west-2
dig api.teachlink.local +trace

# Should show:
# api.teachlink.local.       60      IN      A       10.1.1.5  (us-west-2 ELB)
# NOT:        10.0.1.5  (us-east-1 ELB)
```

### Check 2: API Connectivity

```bash
# Test from multiple locations
for i in {1..3}; do
  echo "Attempt $i..."
  curl -v https://api.teachlink.local/health
  sleep 5
done

# Expected responses:
# HTTP 200 OK (after 1-2 attempts as DNS propagates)
# { "status": "healthy", "database": "ok" }
```

### Check 3: Global Health Dashboard

```
Open: https://monitoring.teachlink.local
Look for:
  ✓ Region shown as: us-west-2
  ✓ All services → Green
  ✓ Error rate (5min) → < 0.1%
  ✓ API latency (p99) → < 500ms (may be higher due to cross-region)
  ✓ Database → Connected to us-west-2 RDS
```

### Check 4: Database Verification

```bash
# Verify we're connected to us-west-2 database
curl -s https://api.teachlink.local/admin/db-info \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.database'

# Expected output:
# {
#   "host": "teachlink-db.us-west-2.rds.amazonaws.com",
#   "region": "us-west-2",
#   "status": "connected"
# }
```

### Check 5: Data Integrity

```bash
# If restore was performed, verify data
curl -s https://api.teachlink.local/admin/data-integrity-check \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.results[] | select(.status != "ok")'

# Should return empty (no issues)
# If issues found, see "Data Corruption Runbook"
```

---

## Communication During Failover

### Stakeholder Updates

| Time | Audience | Message | Channel |
|------|----------|---------|---------|
| T+0 (outage detected) | Internal | AWS us-east-1 outage detected, failover initiated | #incidents |
| T+2 min | Customers | Service disrupted; activating backup region | statuspage.io |
| T+10 min | Customers | Service failover in progress; most users can connect | statuspage.io |
| T+15 min | All | Service restored in us-west-2; degraded latency expected | statuspage.io + social |
| T+2 hrs | All | Incident summary + RCA timeline | statuspage.io + email |

### Status Page Update

```
Post to https://status.teachlink.local

TITLE: "Service Disruption - AWS Region Outage"

INCIDENT: 🔴 Investigating
2026-04-28 14:30 UTC - AWS us-east-1 region experienced unexpected outage
2026-04-28 14:32 UTC - We initiated automated failover to us-west-2
2026-04-28 14:45 UTC - Service restored; users may experience higher latency

COMPONENTS AFFECTED:
- API Server: Investigating → Operational
- Database: Investigating → Operational
- Learning Platform: Investigating → Operational
```

---

## Failover Completion

### Final Validation Checklist

```
✓ DNS resolves to us-west-2
✓ Health endpoint returns "healthy"
✓ Users can successfully authenticate
✓ Database queries execute normally
✓ All required services operational
✓ Monitoring dashboards showing green
✓ No error spikes in logs
✓ Customer complaints declining to normal rate
```

### Time Accounting

```
T+0:    Outage detected
T+2:    Failover script initiated
T+5:    RDS database provisioned and restored
T+10:   Pods deployed in us-west-2
T+12:   Route 53 DNS updated
T+15:   Users reaching us-west-2; service operational
```

**RTO Achieved**: ~15 minutes ✓

---

## Failback Procedure (Execute 4-24 Hours Later)

### Prerequisites for Failback

```
✓ AWS confirms us-east-1 fully recovered
✓ All AWS services available
✓ No ongoing incidents in us-east-1
✓ At least 4 hours of stable operation in us-west-2
✓ Senior engineer approval + CTO sign-off
```

### Failback Steps

**Phase 1: Preparation (30 minutes)**

```bash
# 1. Backup current state in us-west-2
aws rds create-db-snapshot \
  --db-instance-identifier teachlink-db \
  --db-snapshot-identifier teachlink-db-backup-before-failback \
  --region us-west-2

# 2. Sync data from us-west-2 to us-east-1
# Create empty staging DB in us-east-1
aws rds create-db-instance \
  --db-instance-identifier teachlink-db-failback \
  --region us-east-1 \
  ...

# 3. Restore backup from us-west-2 to us-east-1
pg_dump -h teachlink-db.us-west-2.rds.amazonaws.com \
        -U postgres teachlink | \
gzip | \
aws s3 cp - s3://teachlink-backups/failback-sync.sql.gz --region us-east-1

# Restore to failback database
aws s3 cp s3://teachlink-backups/failback-sync.sql.gz - --region us-east-1 | \
gunzip | pg_restore -h teachlink-db-failback.us-east-1.rds.amazonaws.com \
                    -U postgres -d teachlink
```

**Phase 2: Cutover (5-10 minutes)**

```bash
# Update application config back to us-east-1
kubectl set env deployment/api \
  -n production \
  DB_HOST=teachlink-db-failback.us-east-1.rds.amazonaws.com \
  AWS_REGION=us-east-1

# Update Route 53 DNS back to us-east-1
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch 'update weights to us-east-1=100, us-west-2=0'

# Wait 2 minutes for DNS propagation
```

**Phase 3: Cleanup (10 minutes)**

```bash
# Scale down us-west-2 deployment
kubectl scale deployment api -n production --region us-west-2 --replicas 0

# Keep RDS snapshot for 48 hours, then delete
# Delete failback staging database
aws rds delete-db-instance \
  --db-instance-identifier teachlink-db-failback \
  --region us-east-1 \
  --skip-final-snapshot
```

**Phase 4: Verification (5 minutes)**

```bash
✓ DNS resolves to us-east-1
✓ Health endpoint returns "healthy"
✓ Latency returns to baseline (< 200ms p99)
✓ All tests pass
```

---

## When Failover Fails

### Troubleshooting: RDS Restore Slow (> 8 minutes)

**Symptoms**:
```
Database restoration in progress for 10+ minutes
Restore status shows "80% complete" after 5 minutes
```

**Solutions** (in order):

1. **Check database restore logs**
```bash
aws rds describe-event-subscriptions \
  --region us-west-2 | jq '.EventSubscriptionsList[0]'

# Check for I/O bottlenecks or resource issues
```

2. **If restore > 12 minutes**: Skip to data-corruption runbook
```
Consider: Is 7-day old backup acceptable, or do we need more recent data?
```

### Troubleshooting: DNS Not Updating

**Symptoms**:
```
DNS still resolves to us-east-1 after 5 minutes
Route 53 change confirmed, but dig shows old IP
```

**Solutions**:

1. Force DNS cache clear on client:
```bash
# On local machine
sudo dscacheutil -flushcache  # macOS
sudo systemctl restart systemd-resolved  # Linux
```

2. Manually update dev/test machines:
```bash
# Update /etc/hosts temporarily
echo "10.1.1.5  api.teachlink.local" >> /etc/hosts
```

3. If Route 53 not updating:
```bash
# Verify change was applied
aws route53 list-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --query 'ResourceRecordSets[?Name==`api.teachlink.local.`]'

# If old values still there, manually update:
# (See Step 5 DNS Failover above)
```

### Troubleshooting: Partial Service Restoration

**Symptoms**:
```
API responds, but database queries fail
Some services reachable in us-west-2, others timeout
```

**Diagnosis**:
```bash
# Check which pods are running
kubectl get pods -n production -o wide --context=us-west-2

# Check for failed deployments
kubectl describe deployment api -n production

# Check logs for errors
kubectl logs -n production --all-containers=true | grep -i error
```

**Resolution**:
```bash
# Scale pods to 0, then back to 10
kubectl scale deployment api -n production --replicas 0
sleep 10
kubectl scale deployment api -n production --replicas 10

# Or restart entire deployment
kubectl rollout restart deployment/api -n production
```

---

## Escalation

### When to Escalate (Triggers)

| Condition | Action | Contact |
|-----------|--------|---------|
| RTO exceeded (> 15 min) | Immediate executive escalation | CTO, VP Eng |
| Failover script fails | Manual intervention required | Page 3+ senior engineers |
| Both regions unreachable | Enterprise-level issue | AWS Enterprise Support |
| Data integrity issues post-failover | Critical data loss risk | CTO + legal |

### Emergency Contacts

```
On-Call Engineer: PagerDuty (on-call rotation)
Platform Lead: Page via PagerDuty (escalation policy)
CTO: Direct phone (in PagerDuty escalation)
CEO: Email + call (if > 1 hour outage + media)

AWS Enterprise Support:
  - Phone: +1-206-555-0100
  - Console: https://console.aws.amazon.com/support/
  - Case priority: BUSINESS-CRITICAL
```

---

## Post-Incident Actions

### Incident Review (24 hours post-incident)

```
1. Document timeline
   - What time did outage start?
   - When was failover triggered?
   - When was service restored?

2. Review metrics
   - How many users affected?
   - Revenue impact?
   - Data loss (if any)?

3. Identify improvements
   - What could have been faster?
   - Any manual steps that should be automated?
   - Infrastructure changes needed?

4. Plan remediation
   - Increase redundancy?
   - Improve monitoring?
   - Add more frequent failover tests?
```

### Action Items from Review

```
Example:
- [ ] #449 - Automate failover Route 53 updates (2 day effort)
- [ ] #450 - Add cross-region health monitor (1 day effort)
- [ ] #451 - Increase failover test frequency from monthly to weekly (0 effort)
- [ ] #452 - Add secondary backup in eu-west-1 (5 day effort)
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-28  
**Owner**: Platform Engineering / SRE Team  
**Review Schedule**: Monthly (after failover drill)

---

## Quick Links

- [Failover Plan](../procedures/failover-plan.md)
- [RTO/RPO Definitions](../procedures/RTO-RPO.md)
- [Database Failure Runbook](./database-failure.md)
- [Data Corruption Runbook](./data-corruption.md)
- [AWS Status Page](https://status.aws.amazon.com/)
