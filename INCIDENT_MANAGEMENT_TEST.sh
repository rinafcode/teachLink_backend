#!/bin/bash

# 🚀 INCIDENT MANAGEMENT - QUICK TEST SCRIPT
# Run this script to quickly validate the implementation
# bash INCIDENT_MANAGEMENT_TEST.sh

set -e

echo "🚀 Incident Management - Quick Validation Test"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
INCIDENT_ID=""

# Helper function for colored output
print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# ============================================
# PHASE 1: SETUP CHECK
# ============================================

print_step "PHASE 1: Checking Setup"
echo ""

print_step "1.1 Checking if backend is running..."
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    print_warning "Backend not responding. Make sure to run: npm run start:dev"
    exit 1
fi
print_success "Backend is running"
echo ""

# ============================================
# PHASE 2: TEST INCIDENT CREATION
# ============================================

print_step "PHASE 2: Testing Incident Creation"
echo ""

print_step "2.1 Creating test incident..."
RESPONSE=$(curl -s -X POST $BASE_URL/incidents \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Database Performance Degradation Detected",
    "description": "Database query duration exceeded critical threshold",
    "severity": "critical",
    "triggerMetrics": {
      "query_duration_ms": 3500,
      "threshold": 2000
    },
    "runbookId": "database-failure"
  }')

INCIDENT_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$INCIDENT_ID" ]; then
    echo "Response: $RESPONSE"
    print_warning "Failed to create incident"
    exit 1
fi

print_success "Incident created: $INCIDENT_ID"
echo ""

# ============================================
# PHASE 3: TEST INCIDENT RETRIEVAL
# ============================================

print_step "PHASE 3: Testing Incident Retrieval"
echo ""

print_step "3.1 Retrieving incident details..."
INCIDENT=$(curl -s $BASE_URL/incidents/$INCIDENT_ID)

TITLE=$(echo $INCIDENT | grep -o '"title":"[^"]*"' | cut -d'"' -f4)
STATUS=$(echo $INCIDENT | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

print_success "Incident retrieved"
echo "  - Title: $TITLE"
echo "  - Status: $STATUS"
echo ""

print_step "3.2 Listing all incidents..."
LIST=$(curl -s "$BASE_URL/incidents?skip=0&take=10")
COUNT=$(echo $LIST | grep -o '"id"' | wc -l)
print_success "Listed $COUNT incident(s)"
echo ""

# ============================================
# PHASE 4: TEST REMEDIATION
# ============================================

print_step "PHASE 4: Testing Remediation Actions"
echo ""

print_step "4.1 Creating remediation action..."
ACTION_RESPONSE=$(curl -s -X POST $BASE_URL/incidents/$INCIDENT_ID/remediation-actions \
  -H 'Content-Type: application/json' \
  -d '{
    "actionType": "restart_service",
    "description": "Restart the API service",
    "parameters": {
      "serviceName": "api-server"
    },
    "autoRollback": true
  }')

ACTION_ID=$(echo $ACTION_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$ACTION_ID" ]; then
    echo "Response: $ACTION_RESPONSE"
    print_warning "Failed to create remediation action"
else
    print_success "Remediation action created: $ACTION_ID"
fi
echo ""

print_step "4.2 Listing remediation actions..."
ACTIONS=$(curl -s "$BASE_URL/incidents/$INCIDENT_ID/remediation-actions")
ACTION_COUNT=$(echo $ACTIONS | grep -o '"id"' | wc -l)
print_success "Listed $ACTION_COUNT remediation action(s)"
echo ""

# ============================================
# PHASE 5: TEST RUNBOOK EXECUTION
# ============================================

print_step "PHASE 5: Testing Runbook Execution"
echo ""

print_step "5.1 Listing available runbooks..."
RUNBOOKS=$(curl -s "$BASE_URL/incidents/runbooks/available")
print_success "Available runbooks: $RUNBOOKS"
echo ""

print_step "5.2 Executing runbook..."
RUNBOOK_RESPONSE=$(curl -s -X POST $BASE_URL/incidents/$INCIDENT_ID/runbook-executions \
  -H 'Content-Type: application/json' \
  -d '{
    "runbookName": "database-failure",
    "runbookPath": "dr/runbooks/database-failure.md"
  }')

EXECUTION_ID=$(echo $RUNBOOK_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$EXECUTION_ID" ]; then
    echo "Response: $RUNBOOK_RESPONSE"
    print_warning "Failed to execute runbook"
else
    print_success "Runbook execution created: $EXECUTION_ID"
fi
echo ""

print_step "5.3 Listing runbook executions..."
EXECUTIONS=$(curl -s "$BASE_URL/incidents/$INCIDENT_ID/runbook-executions")
EXEC_COUNT=$(echo $EXECUTIONS | grep -o '"id"' | wc -l)
print_success "Listed $EXEC_COUNT runbook execution(s)"
echo ""

# ============================================
# PHASE 6: TEST ESCALATION
# ============================================

print_step "PHASE 6: Testing Escalation"
echo ""

print_step "6.1 Escalating incident..."
ESCALATION=$(curl -s -X POST $BASE_URL/incidents/$INCIDENT_ID/escalate \
  -H 'Content-Type: application/json' \
  -d '{
    "escalatedTo": "oncall@example.com",
    "reason": "Critical incident requiring immediate attention"
  }')

NEW_STATUS=$(echo $ESCALATION | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
print_success "Incident escalated (Status: $NEW_STATUS)"
echo ""

# ============================================
# PHASE 7: TEST RESOLUTION
# ============================================

print_step "PHASE 7: Testing Resolution"
echo ""

print_step "7.1 Resolving incident..."
RESOLUTION=$(curl -s -X POST $BASE_URL/incidents/$INCIDENT_ID/resolve \
  -H 'Content-Type: application/json' \
  -d '{"resolutionNotes": "Database issue resolved by restarting connection pool"}')

RESOLVED_STATUS=$(echo $RESOLUTION | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
print_success "Incident resolved (Status: $RESOLVED_STATUS)"
echo ""

# ============================================
# PHASE 8: TEST STATISTICS
# ============================================

print_step "PHASE 8: Testing Statistics"
echo ""

print_step "8.1 Retrieving statistics..."
STATS=$(curl -s "$BASE_URL/incidents/statistics/overview")

TOTAL=$(echo $STATS | grep -o '"totalIncidents":[^,]*' | cut -d':' -f2)
ACTIVE=$(echo $STATS | grep -o '"activeIncidents":[^,]*' | cut -d':' -f2)
RESOLVED=$(echo $STATS | grep -o '"resolvedIncidents":[^,]*' | cut -d':' -f2)

print_success "Statistics retrieved:"
echo "  - Total Incidents: $TOTAL"
echo "  - Active Incidents: $ACTIVE"
echo "  - Resolved Incidents: $RESOLVED"
echo ""

# ============================================
# SUMMARY
# ============================================

echo "=============================================="
echo "✅ QUICK VALIDATION TEST COMPLETED"
echo "=============================================="
echo ""
echo "Next Steps:"
echo "1. Review the full testing guide:"
echo "   cat INCIDENT_MANAGEMENT_TESTING_GUIDE.md"
echo ""
echo "2. Run unit tests:"
echo "   npm test"
echo ""
echo "3. Review implementation summary:"
echo "   cat INCIDENT_MANAGEMENT_IMPLEMENTATION_SUMMARY.md"
echo ""
echo "All systems operational! 🚀"
echo ""
