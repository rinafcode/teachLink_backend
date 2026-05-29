# Incident Management Module

This module implements an automated response system for common incidents with the following capabilities:

## 🎯 Features

### 1. **Incident Detection**
- Automatically detects incidents based on alert patterns
- Analyzes alert severity and consecutive occurrences
- Creates incident records with appropriate severity levels
- Tracks trigger metrics and detection statistics

### 2. **Automatic Remediation**
- Executes predefined remediation actions automatically
- Supports multiple action types:
  - Service restart
  - Cache clearing
  - Resource scaling
  - Database operations
- Auto-rollback capability for failed actions
- Tracks all remediation attempts and results

### 3. **Runbook Execution**
- Executes predefined runbook procedures
- Supports standard runbooks:
  - Database failure recovery
  - Region outage failover
  - Data corruption recovery
- Tracks step-by-step execution progress
- Generates execution summaries

### 4. **Notification & Escalation**
- Multi-channel notifications (Email, Slack, PagerDuty, Webhooks)
- Severity-based escalation policies
- Auto-escalation after time thresholds
- Incident resolution notifications
- Configurable recipient lists

## 📁 Module Structure

```
src/incident-management/
├── entities/                          # Database models
│   ├── incident.entity.ts            # Incident records
│   ├── remediation-action.entity.ts   # Remediation action history
│   └── runbook-execution.entity.ts    # Runbook execution logs
├── dto/                               # Data transfer objects
│   ├── incident.dto.ts
│   ├── remediation-action.dto.ts
│   └── runbook-execution.dto.ts
├── services/                          # Core services
│   ├── incident-detection.service.ts  # Alert processing & pattern matching
│   ├── auto-remediation.service.ts    # Remediation action execution
│   ├── runbook-execution.service.ts   # Runbook orchestration
│   └── notification-and-escalation.service.ts  # Notifications
├── tests/                             # Unit tests
│   ├── incident-detection.service.spec.ts
│   ├── auto-remediation.service.spec.ts
│   └── runbook-execution.service.spec.ts
├── incident-management.service.ts     # Main orchestration service
├── incident-management.controller.ts  # REST API endpoints
└── incident-management.module.ts      # Module definition
```

## 🔌 API Endpoints

### Incident Management
- `POST /incidents` - Create incident
- `GET /incidents` - List incidents (with filtering by status/severity)
- `GET /incidents/:id` - Get incident details
- `PUT /incidents/:id` - Update incident
- `POST /incidents/:id/resolve` - Resolve incident
- `POST /incidents/:id/escalate` - Escalate incident

### Remediation Actions
- `POST /incidents/:id/remediation-actions` - Create remediation action
- `GET /incidents/:id/remediation-actions` - List remediation actions

### Runbook Execution
- `POST /incidents/:id/runbook-executions` - Execute runbook
- `GET /incidents/:id/runbook-executions` - List runbook executions
- `GET /incidents/runbooks/available` - List available runbooks

### Statistics
- `GET /incidents/statistics/overview` - Get incident management statistics

## 🚀 Quick Start

### 1. Module Registration
The module is automatically imported in `app.module.ts`.

### 2. Database Setup
```bash
# Migrations are auto-run on startup
npm run start:dev
```

### 3. Create Your First Incident
```bash
curl -X POST http://localhost:3000/incidents \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "High HTTP Error Rate",
    "description": "Error rate exceeded threshold",
    "severity": "critical",
    "runbookId": "error-rate-investigation"
  }'
```

## 📊 Detection Rules

The system includes built-in detection rules for:
- Database performance degradation
- High CPU/Memory utilization
- High HTTP error rates
- Cache hit rate degradation
- Queue processing delays
- API latency issues

Add custom rules by extending `INCIDENT_DETECTION_RULES` in `incident-detection.service.ts`.

## 🔧 Customization

### Add Custom Remediation Action
```typescript
// In auto-remediation.service.ts, add to handlers array:
class CustomHandler implements RemediationHandler {
  canHandle(actionType: string): boolean {
    return actionType === 'custom_action';
  }

  async execute(parameters): Promise<...> {
    // Implementation
  }
}
```

### Add Custom Escalation Policy
```typescript
const policy: EscalationPolicy = {
  delayMs: 2 * 60 * 1000,
  severity: IncidentSeverity.WARNING,
  recipients: [{
    channel: NotificationChannel.EMAIL,
    address: 'custom-team@example.com'
  }],
  maxRetries: 2
};

notificationService.registerEscalationPolicy('custom', policy);
```

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test -- src/incident-management/tests/incident-detection.service.spec.ts
```

### Test with Coverage
```bash
npm run test:ci
```

## 📖 Comprehensive Testing Guide

For detailed step-by-step testing and validation, see [INCIDENT_MANAGEMENT_TESTING_GUIDE.md](../../INCIDENT_MANAGEMENT_TESTING_GUIDE.md)

## 🔄 Incident Lifecycle

```
Detection → Remediation → Runbook → Notification → Escalation → Resolution
   ↓            ↓             ↓           ↓            ↓            ↓
Alert      Auto Actions   Execute    Notify Team   Critical Issues  Resolved
Pattern    Triggered      Procedures  Channels      Escalated        Tracked
```

## 📈 Monitoring

Track incident management metrics:
- Total incidents created
- Active vs. resolved incidents
- Remediation success rate
- Average resolution time
- Escalation frequency
- Detection accuracy

## 🔐 Security

- Incident data stored securely in database
- Authentication required for API endpoints (add via guards)
- Sensitive parameters not logged
- Escalation policies configurable per environment

## 📝 Environment Variables

Optional configuration:
```
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=notifications@example.com
EMAIL_PASSWORD=password
EMAIL_FROM=incidents@teachlink.io

SLACK_WEBHOOK_URL=https://hooks.slack.com/...
PAGERDUTY_INTEGRATION_KEY=key-here

# Incident management specific
INCIDENT_AUTO_REMEDIATE=true
INCIDENT_AUTO_ESCALATE=true
```

## 🤝 Contributing

To extend the incident management system:
1. Add new detection rules in `incident-detection.service.ts`
2. Implement custom remediation handlers
3. Create new runbook definitions in `dr/runbooks/`
4. Add tests for new functionality
5. Update documentation

## 📞 Support

For issues or questions:
1. Check the testing guide: [INCIDENT_MANAGEMENT_TESTING_GUIDE.md](../../INCIDENT_MANAGEMENT_TESTING_GUIDE.md)
2. Review test cases for usage examples
3. Check application logs for errors
4. Verify database migrations completed
